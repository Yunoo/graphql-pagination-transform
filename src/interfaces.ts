import { DocumentNode } from 'graphql'

export interface IFoundObjectTypes {
  [typeName: string]: any
}

export interface ICacheControlOptions {
  enable?: boolean
  apollo?: boolean
}

export interface IGetSchemaDirectivesInput {
  typeDefs: DocumentNode | DocumentNode[]
  overrideDirectiveName?: string
  cacheControl?: ICacheControlOptions
}

export interface IEdgeInterfaceFields {
  name: string
  header: string
  fields: string
}
