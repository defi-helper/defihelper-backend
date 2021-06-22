import { Express, Request } from 'express';
import { Server } from 'http';
import { ApolloServer } from 'apollo-server-express';
import { json } from 'body-parser';
import {
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from 'graphql';
import { AuthEthereumInputType, AuthType, UserType } from './schema/user';
import container from '@container';
import { currentUser } from './middlewares/currentUser';
import { utils } from 'ethers';
import { Role } from '@models/User/Entity';

export function route({ express, server }: { express: Express; server: Server }) {
  const apollo = new ApolloServer({
    schema: new GraphQLSchema({
      query: new GraphQLObjectType<undefined, Request>({
        name: 'Query',
        fields: {
          ping: {
            type: GraphQLNonNull(GraphQLString),
            resolve: () => 'pong',
          },
          me: {
            type: UserType,
            resolve: (root, args, { currentUser }) => currentUser,
          },
          authEth: {
            type: AuthType,
            args: {
              input: {
                type: GraphQLNonNull(AuthEthereumInputType),
              },
            },
            resolve: async (root, { input }, { currentUser }) => {
              const { network, address, message, signature } = input;
              if (typeof message !== 'string' || message.length < 5) return null;

              const hash = utils.hashMessage(message);
              const hashBytes = utils.arrayify(hash);
              const recoveredPubKey = utils.recoverPublicKey(hashBytes, signature);
              const recoveredAddress = utils.recoverAddress(hashBytes, signature).toLowerCase();
              if (address.toLowerCase() !== recoveredAddress) return null;

              const duplicate = await container.model
                .walletTable()
                .where({
                  blockchain: 'ethereum',
                  network,
                  address: recoveredAddress,
                })
                .first();

              if (duplicate) {
                const user = await container.model.userTable().where('id', duplicate.user).first();
                if (!user) return null;

                const sid = container.model.sessionService().generate(user);
                return { user, sid };
              } else {
                const user = currentUser ?? (await container.model.userService().create(Role.User));
                await container.model
                  .walletService()
                  .create(user, 'ethereum', network, recoveredAddress, recoveredPubKey);
                const sid = container.model.sessionService().generate(user);

                return { user, sid };
              }
            },
          },
        },
      }),
    }),
    subscriptions: '/api',
    playground: true,
    context: ({ req }) => req,
  });
  apollo.installSubscriptionHandlers(server);
  express.use('/api', [json(), currentUser, apollo.getMiddleware({ path: '/' })]);
}
