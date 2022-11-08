# GraphQL pagination transform

Transforms GraphQL schema fields into a [relay connections](https://relay.dev/graphql/connections.htm) using a `@connection` directive.

---

## Features

* Create the needed Connection and Edge object types.
* Reassign the type of marked fields to the Connection type.
* Remove any `@connection` directives.
* Generate the PageInfo object type if it hasn't been defined.
* Support non-nullable types
* Throw errors if the generated Connection and Edge types have a name conflict with types already defined in your SDL.
* Leave everything else in your SDL untouched.
* Apply cacheControl directives to Connection and Edge types if exist.
* Works with Apollo Federation schemas

## Usage examples

1. Install library
```bash
npm install --save graphql-pagination-transform
```

2. Add `@connection` directive to the fields in your schema that needs to be transformed into relay connections.

3. Import connecton directive from this lib
```js
import { connectionDirective } from 'graphql-pagination-transform'

const { connectionDirectiveTypeDefs } = connectionDirective()
```

4. Merge it with your schema type definitions


```js
import gql from 'graphql'
import typeDefs from './typeDefs' // Path to your schema type definitions

const schema = gql([typeDefs, connectionDirectiveTypeDefs])

export default schema
```

or using `mergeTypeDefs` from `graphql-tools` in case your type definitions are `DocumentNode`'s
```js
import { mergeTypeDefs } from '@graphql-tools/merge'
import typeDefs from './typeDefs' // Path to your schema type definitions

const schema = mergeTypeDefs([assetTypeDefs, scalarTypes, directiveTypeDefs])

export default schema
```

5. Transform type definitions. This will remove all `@connection` directives and create connection types with edges, nodes and pageInfo
```js
import transform from 'graphql-directive-connection'
impot schema from './schema'

const result = transform({ typeDefs, cacheControl: { enable: true, apollo: true } })
```

Transformation result is a string representation of your type definitions. You will probaly want to convert it to `GraphQLSchema` type later.
This could be archived using `graphql-tools` [makeExecutableSchema](https://www.the-guild.dev/graphql/tools/docs/generate-schema#makeexecutableschema) or Apollo [buildSubgraphSchema](https://www.apollographql.com/docs/federation/api/apollo-subgraph/) (for Apollo Federation).

## cacheControl directives

This plugin will apply `cacheControl` directive on `Connection` type, `edge` and `pageInfo` fields by default. 

Remember to add `cacheControl` directive to your schema in case you are not explicitly disabling it in a transform function.

```graphql
enum CacheControlScope {
  PUBLIC
  PRIVATE
}

directive @cacheControl(
  maxAge: Int
  scope: CacheControlScope
  inheritMaxAge: Boolean
) on FIELD_DEFINITION | OBJECT | INTERFACE | UNION
```

In order to completely ignore cache arguments and disable cacheControl directive pass `cacheControl: false` or `cacheControl: { enable: false }` argument to `transform` (default plugin export) function. The package will then use the largest `maxAge` across the connection fields with custom types and apply it to non-scalar fields and types (e.g. `edges`, `node` and `pageInfo`). 

`GraphQL Apollo v3` and later supports `inheritMaxAge` argument which forces a particular field to inherit the `maxAge` of its parent field. You can enable this feature by passing `cacheControl: { enable: true, apollo: true }` to a `transform` function.

Keep in mind that due to the modified cacheControl heuristics in Apollo v3+ this *could* technically make any queries with `Connection` types uncacheable (see https://www.apollographql.com/docs/apollo-server/performance/caching/#why-are-these-the-maxage-defaults).
Enabling `defaultMaxAge` across your GraphQL implementation might partially solve the problem, but only for `Apollo v2` and lower versions. Thus, it is recommended to leave cacheControl directives enabled.

## Authors

* [taylrun](https://github.com/taylrun) - *Initial idea*
* [Yunoo](https://github.com/Yunoo) - *Lib re-write and development*
