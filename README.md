# graphql-pagination-transform

This package transforms fields into a [relay connections](https://relay.dev/graphql/connections.htm) using a `@connection` directive.

## Features
* Create the needed Connection and Edge object types.
* Reassign the type of marked fields to the Connection type.
* Remove any `@connection` directives.
* Generate the PageInfo object type if it hasn't been defined.
* Throw errors if the generated Connection and Edge types have a name conflict with types already defined in your SDL.
* Leave everything else in your SDL untouched.
* Apply cacheControl directives to Connection and Edge types if exist.
* Works with Apollo Federation schemas

## Usage examples
### TODO

## cacheControl directives

This plugin will apply `cacheControl` directive on `Connection` type, `edge` and `pageInfo` fields by default. 

In order to completely ignore cache arguments and disable cacheControl directive pass `cacheControl: false` or `cacheControl: { enable: false }` argument to `transform` (default plugin export) function. The package will then use the largest `maxAge` across the connection fields with custom types and apply it to non-scalar fields and types (e.g. `connection`, `edges` and `pageInfo`). 
`Apollo v3` supports `inheritMaxAge` argument which forces a particular field to inherit the `maxAge` of its parent field. You can enable this feature by passing `cacheControl: { enable: true, apollo: true }` to a `transform` function.

Keep in mind that due to the modified cacheControl heuristics in Apollo v3+ this *could* technically make any queries with `Connection` types uncacheable (see https://www.apollographql.com/docs/apollo-server/performance/caching/#why-are-these-the-maxage-defaults).
Enabling `defaultMaxAge` across your GraphQL implementation might partially solve the problem, but only for `Apollo v2` and lower versions. Thus, it is recommended to leave cacheControl directives enabled.

## Authors

* [taylrun](https://github.com/taylrun) - *Initial idea and work* - 
* [Yunoo](https://github.com/Yunoo) - *Lib re-write and development* - 
