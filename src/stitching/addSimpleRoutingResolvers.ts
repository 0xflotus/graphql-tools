import { mapValues, isEmpty } from 'lodash';
import { printSchema, print, ExecutionResult } from 'graphql';
import { GraphQLFieldResolver, GraphQLSchema } from 'graphql';
import { makeExecutableSchema } from '../schemaGenerator';

type ResolverMap = { [key: string]: GraphQLFieldResolver<any, any> };

export type Fetcher = (
  operation: {
    query: string;
    operationName?: string;
    variables?: { [key: string]: any };
  },
) => Promise<ExecutionResult>;

export default function addSimpleRoutingResolvers(
  schema: GraphQLSchema,
  fetcher: Fetcher,
): GraphQLSchema {
  const queries = schema.getQueryType().getFields();
  const queryResolvers: ResolverMap = mapValues(queries, (field, key) =>
    createResolver(fetcher, key),
  );
  let mutationResolvers: ResolverMap = {};
  const mutationType = schema.getMutationType();
  if (mutationType) {
    const mutations = mutationType.getFields();
    mutationResolvers = mapValues(mutations, (field, key) =>
      createResolver(fetcher, key),
    );
  }

  const resolvers: {
    Query: ResolverMap;
    Mutation?: ResolverMap;
  } = { Query: queryResolvers };

  if (!isEmpty(mutationResolvers)) {
    resolvers.Mutation = mutationResolvers;
  }

  const typeDefs = printSchema(schema);

  return makeExecutableSchema({
    typeDefs,
    resolvers,
  });
}

function createResolver(
  fetcher: Fetcher,
  name: string,
): GraphQLFieldResolver<any, any> {
  return async (root, args, context, info) => {
    const query = print(info.operation);
    const result = await fetcher({
      query,
      variables: info.variableValues,
    });
    if (result.errors || !result.data[name]) {
      throw result.errors;
    } else {
      return result.data[name];
    }
  };
}
