import { GraphQLSchema } from 'graphql'
import {
  mapSchema,
  getDirective,
  getDirectives,
  MapperKind,
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
    node: ${typeName} ${cacheControl}
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
  if (args === undefined) return '@cacheControl(inheritMaxAge: true)'
  if (args?.hasOwnProperty('maxAge'))
    return `@cacheControl(maxAge: ${args.maxAge})`
  return ''
}

export const getConnectionDirectiveTypeDefs = (
  directiveName: string
): string => {
  return `directive @${directiveName || 'connection'} on FIELD_DEFINITION`
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
  const useApolloInheritMaxAge = cacheControlOptions?.apollo
  return {
    connectionObjects: () => objectTypes,
    connectionDirectiveTypeDefs: getConnectionDirectiveTypeDefs(name),
    connectionDirectiveTransformer: (schema: GraphQLSchema) => {
      const mapper = (fieldConfig: any): any => {
        const directives = getDirectives(schema, fieldConfig)
        if (!directives?.length) return fieldConfig
        const type = fieldConfig.astNode?.type
        const typeName: string = type?.name?.value || type?.type?.name?.value
        if (!typeName) return fieldConfig

        const connectionDirective = directives.find(
          (value) => value.name === name
        )

        if (!connectionDirective) return fieldConfig
        if (!useCacheControl) {
          // Skip cacheContol directives
          if (!objectTypes.hasOwnProperty(typeName)) objectTypes[typeName] = {}
          return fieldConfig
        }

        const cacheControlDirective = directives.find(
          (value) => value.name === 'cacheControl'
        )

        if (useApolloInheritMaxAge) {
          // Rely on inheritMaxAge instead of calculating maxAge (Apollo v3+)
          if (!objectTypes.hasOwnProperty(typeName))
            objectTypes[typeName] = undefined
          return fieldConfig
        }

        // Fallback to legacy cacheControl calculation (when inheritMaxAge is not supported)
        const args = cacheControlDirective?.args || {}
        if (!objectTypes.hasOwnProperty(typeName)) objectTypes[typeName] = args
        else if (args?.maxAge > objectTypes[typeName]?.maxAge)
          objectTypes[typeName].maxAge = args.maxAge

        return fieldConfig
      }
      return mapSchema(schema, {
        [MapperKind.INTERFACE_FIELD]: mapper,
        [MapperKind.OBJECT_FIELD]: mapper,
      })
    },
  }
}
