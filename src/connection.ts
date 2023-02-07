import { GraphQLSchema, valueFromAST } from 'graphql'
import {
  mapSchema,
  getDirective,
  getDirectives,
  MapperKind,
  DirectiveAnnotation,
} from '@graphql-tools/utils'
import { ICacheControlOptions, IFoundObjectTypes } from './interfaces'

export const PageInfo = `
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }`

export const Edge = (typeName: string, args: any) => {
  const cacheControl = composeCacheContolDirective(args)
  const { name, header, fields }: any = args
  return `
  type ${name || typeName}Edge ${header || ''} {
    cursor: String!
    node: ${typeName.replace('NonNull', '')}${
    args?.NonNull === true ? '!' : ''
  } ${cacheControl}
    ${fields || ''}
  }
`
}

export const Connection = (typeName: string, args: any) => {
  const cacheControl = composeCacheContolDirective(args)
  return `
  type ${typeName}Connection ${cacheControl} {
    totalCount: Int!
    edges: [${typeName}Edge] ${cacheControl}
    pageInfo: PageInfo! ${cacheControl}
  }`
}

const composeCacheContolDirective = (args: any) => {
  if (args?.useApolloInheritMaxAge) return '@cacheControl(inheritMaxAge: true)'
  if (args?.hasOwnProperty('maxAge'))
    return `@cacheControl(maxAge: ${args.maxAge})`
  return ''
}

const checkEdgeInterfaceArgs = (
  typeName: string,
  objectTypes: IFoundObjectTypes,
  connectionDirective: DirectiveAnnotation,
  schema: GraphQLSchema
): void => {
  if (!objectTypes.hasOwnProperty(typeName)) return
  const directiveEdgeInterfaceName = (
    connectionDirective.args?.edgeInterface as string
  )?.trim()

  if (directiveEdgeInterfaceName && !schema.getType(directiveEdgeInterfaceName))
    throw new Error(
      `Missing '${directiveEdgeInterfaceName}' interface type (set in ${typeName} type connection directive). Did you forget to define it in the schema?`
    )
}

export const getConnectionDirectiveTypeDefs = (
  directiveName: string
): string => {
  return `directive @${
    directiveName || 'connection'
  }(edgeInterface: String) on FIELD_DEFINITION`
}

// Find connection directives
export default (
  directiveName?: string,
  cacheControlOptions?: ICacheControlOptions
) => {
  const name = directiveName || 'connection'
  const objectTypes: IFoundObjectTypes = {}
  const useCacheControl =
    cacheControlOptions?.enable ?? Boolean(cacheControlOptions)
  const useApolloInheritMaxAge = !!cacheControlOptions?.apollo
  return {
    connectionObjects: () => objectTypes,
    connectionDirectiveTypeDefs: getConnectionDirectiveTypeDefs(name),
    connectionDirectiveTransformer: (schema: GraphQLSchema) => {
      const mapper = (fieldConfig: any): any => {
        const directives = getDirectives(schema, fieldConfig)
        if (!directives?.length) return fieldConfig
        const type = fieldConfig.astNode?.type
        const args = { NonNull: type.kind === 'NonNullType' }
        const typeName = `${type?.name?.value || type?.type?.name?.value}${
          args.NonNull ? 'NonNull' : ''
        }`

        if (!typeName) return fieldConfig

        const connectionDirective = directives.find(
          (value) => value.name === name
        )

        if (!connectionDirective) return fieldConfig
        checkEdgeInterfaceArgs(
          typeName,
          objectTypes,
          connectionDirective,
          schema
        )

        const edgeList = objectTypes[typeName]?.edgeInterface || []
        const { edgeInterface } = connectionDirective?.args as any
        if (!edgeList.includes(edgeInterface)) edgeList.push(edgeInterface)

        // typeName = `${typeName}${args.NonNull ? 'NonNull' : ''}`

        if (!useCacheControl) {
          // Skip cacheContol directives

          objectTypes[typeName] = {
            ...args,
            edgeInterface: edgeList,
          }

          return fieldConfig
        }

        if (useApolloInheritMaxAge) {
          // Rely on inheritMaxAge instead of calculating maxAge (Apollo v3+)
          objectTypes[typeName] = {
            ...args,
            edgeInterface: edgeList,
            useApolloInheritMaxAge,
          }

          return fieldConfig
        }

        const cacheControlDirective = directives.find(
          (value) => value.name === 'cacheControl'
        )

        // Fallback to legacy cacheControl calculation (when inheritMaxAge is not supported)
        const cacheControlArgs = cacheControlDirective?.args || {}
        objectTypes[typeName] = {
          ...args,
          edgeInterface: edgeList,
          ...cacheControlArgs,
          maxAge:
            cacheControlArgs?.maxAge > objectTypes[typeName]?.maxAge
              ? cacheControlArgs.maxAge
              : objectTypes[typeName]?.maxAge,
        }
        return fieldConfig
      }
      return mapSchema(schema, {
        [MapperKind.INTERFACE_FIELD]: mapper,
        [MapperKind.OBJECT_FIELD]: mapper,
      })
    },
  }
}
