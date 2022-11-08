import {
  InputValueDefinitionNode,
  GraphQLInt,
  GraphQLString,
  Kind,
  DocumentNode,
  GraphQLSchema,
} from 'graphql'
import {
  mapSchema,
  getDirective,
  MapperKind,
  printSchemaWithDirectives,
} from '@graphql-tools/utils'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { mergeTypeDefs } from '@graphql-tools/merge'

import connectionDirective, { Connection, Edge, PageInfo } from './connection'

import { IFoundObjectTypes, IGetSchemaDirectivesInput } from './interfaces'

export const createConnectionTypes = (
  objectTypes: IFoundObjectTypes
): string[] => {
  return [
    !objectTypes.hasOwnProperty('PageInfo') ? PageInfo : undefined,
    ...Object.entries(objectTypes).reduce((acc: string[], [typeName, args]) => {
      if (!!objectTypes.hasOwnProperty(`${typeName}Edge`))
        throw new Error(`${typeName}Edge already exists.`)
      if (!!objectTypes.hasOwnProperty(`${typeName}Connection`))
        throw new Error(`${typeName}Connection already exists.`)
      return [...acc, Edge(typeName, args), Connection(typeName, args)]
    }, []),
  ].filter((node): node is string => !!node)
}

const getConnectionArgs = (): {
  args: any
  argumentsAST: InputValueDefinitionNode[]
} => {
  const argumentsAST: InputValueDefinitionNode[] = [
    {
      kind: Kind.INPUT_VALUE_DEFINITION,
      description: undefined,
      name: {
        kind: Kind.NAME,
        value: 'after',
      },
      type: {
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: 'String',
        },
      },
      defaultValue: undefined,
      directives: [],
    },
    {
      kind: Kind.INPUT_VALUE_DEFINITION,
      description: undefined,
      name: {
        kind: Kind.NAME,
        value: 'first',
      },
      type: {
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: 'Int',
        },
      },
      defaultValue: undefined,
      directives: [],
    },
    {
      kind: Kind.INPUT_VALUE_DEFINITION,
      description: undefined,
      name: {
        kind: Kind.NAME,
        value: 'before',
      },
      type: {
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: 'String',
        },
      },
      defaultValue: undefined,
      directives: [],
    },
    {
      kind: Kind.INPUT_VALUE_DEFINITION,
      description: undefined,
      name: {
        kind: Kind.NAME,
        value: 'last',
      },
      type: {
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: 'Int',
        },
      },
      defaultValue: undefined,
      directives: [],
    },
  ]

  const args = argumentsAST.reduce((acc: any, value: any) => {
    const name = value?.name?.value
    const type = value?.type?.name?.value
    if (!name || !type) return acc
    acc[name] = {
      description: undefined,
      type: type === 'String' ? GraphQLString : GraphQLInt,
      defaultValue: undefined,
      deprecationReason: undefined,
      extensions: undefined,
      astNode: value,
    }
    return acc
  }, {})

  return { args, argumentsAST }
}

const schemaBuilder = (
  typeDefs: DocumentNode | DocumentNode[]
): GraphQLSchema => {
  return makeExecutableSchema({
    typeDefs,
    resolverValidationOptions: { requireResolversForResolveType: 'ignore' },
    assumeValidSDL: true,
  })
}

export default ({
  typeDefs,
  overrideDirectiveName,
  cacheControl = { enable: true },
}: IGetSchemaDirectivesInput): string => {
  const directiveName = overrideDirectiveName || 'connection'

  const {
    connectionObjects,
    connectionDirectiveTypeDefs,
    connectionDirectiveTransformer,
  } = connectionDirective(directiveName, cacheControl)

  // Run transformer to get all types with connection directives
  connectionDirectiveTransformer(schemaBuilder(typeDefs))

  const objectTypeList = connectionObjects()
  const connectionTypeDefs = createConnectionTypes(objectTypeList)
  const schema = schemaBuilder(
    mergeTypeDefs([typeDefs, connectionTypeDefs, connectionDirectiveTypeDefs])
  )

  const schemaMapper = (fieldConfig: any): any => {
    const connectionDirectiveType = getDirective(
      schema,
      fieldConfig,
      directiveName
    )?.[0]

    if (!connectionDirectiveType) return fieldConfig

    const typeName = fieldConfig.type?.toString()?.replace('!', 'NonNull')
    const targetType = schema.getType(`${typeName}Connection`)
    if (!typeName || !targetType) return fieldConfig
    fieldConfig.type = targetType
    fieldConfig.astNode.type = targetType.astNode

    const { args, argumentsAST } = getConnectionArgs()
    fieldConfig.args = { ...fieldConfig.args, ...args }
    fieldConfig.astNode.arguments = [
      ...(fieldConfig.astNode.arguments || []),
      ...argumentsAST,
    ]

    fieldConfig.astNode.directives = fieldConfig.astNode.directives.filter(
      (value: any) => !value?.name?.value?.includes(directiveName)
    )

    return fieldConfig
  }

  // Transform types with a connection directive into a connection type
  return printSchemaWithDirectives(
    mapSchema(schema, {
      [MapperKind.INTERFACE_FIELD]: schemaMapper,
      [MapperKind.OBJECT_FIELD]: schemaMapper,
    })
  )
}
