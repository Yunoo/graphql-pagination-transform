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
  return `
  type ${typeName}Edge {
    cursor: String!
    node: ${typeName.replace('NonNull', '')}${
    args?.NonNull === true ? '!' : ''
  } ${cacheControl}
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

const parseExtract = (
  typeName: string,
  objectTypes: IFoundObjectTypes,
  connectionDirective: DirectiveAnnotation
): void => {
  if (!objectTypes.hasOwnProperty(typeName)) return
  const type = objectTypes[typeName]
  const currentEdgeInterfaceName = (type.edgeInterface as string)?.trim()
  const directiveEdgeInterfaceName = (
    connectionDirective.args?.edgeInterface as string
  )?.trim()

  if (
    type.edgeInterface &&
    connectionDirective.args?.edgeInterface &&
    currentEdgeInterfaceName !== directiveEdgeInterfaceName
  )
    throw new Error(
      `A connection of the same node type ${typeName} cannot be edgeInterfaceed using different interfaces of "${currentEdgeInterfaceName}" and "${directiveEdgeInterfaceName}"`
    )

  if (
    (!currentEdgeInterfaceName && directiveEdgeInterfaceName) ||
    (currentEdgeInterfaceName && !directiveEdgeInterfaceName)
  )
    throw new Error(
      'An interface name should be explicitly written in all connections of the same type'
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
        if (!useCacheControl) {
          // Skip cacheContol directives

          parseExtract(typeName, objectTypes, connectionDirective)
          objectTypes[typeName] = { ...args, ...connectionDirective.args }

          return fieldConfig
        }

        if (useApolloInheritMaxAge) {
          // Rely on inheritMaxAge instead of calculating maxAge (Apollo v3+)

          parseExtract(typeName, objectTypes, connectionDirective)
          objectTypes[typeName] = {
            ...args,
            ...connectionDirective.args,
            useApolloInheritMaxAge,
          }

          return fieldConfig
        }

        const cacheControlDirective = directives.find(
          (value) => value.name === 'cacheControl'
        )

        // Fallback to legacy cacheControl calculation (when inheritMaxAge is not supported)
        parseExtract(typeName, objectTypes, connectionDirective)
        const cacheControlArgs = cacheControlDirective?.args || {}
        objectTypes[typeName] = {
          ...args,
          ...connectionDirective.args,
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
