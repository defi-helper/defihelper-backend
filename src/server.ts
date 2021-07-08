import 'module-alias/register';
import container from './container';
import { createServer } from 'http';
import Express from 'express';
import { route } from '@api/router';

container.model
  .migrationService()
  .up()
  .then(async () => {
    const express = Express();
    const server = createServer(express);
    route({ express, server });

    const port = container.parent.api.port;
    server.listen(port, () => console.log(`Listen ${port}`));

    const telegramService = container.telegram();
    telegramService.startHandler();

    /*
    const provider = container.blockchain.ethereum.provider['56']();
    const staking = container.blockchain.ethereum.contract(
      '0x4F55B9fA30E3B11D0D6DeE828FA905eAeaaE62ee',
      [
        {
          inputs: [],
          name: 'rewardsToken',
          outputs: [
            {
              name: '',
              type: 'address',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              name: 'account',
              type: 'address',
            },
          ],
          name: 'balanceOf',
          outputs: [
            {
              name: '',
              type: 'uint256',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [],
          name: 'totalSupply',
          outputs: [
            {
              name: '',
              type: 'uint256',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
      ],
      provider,
    );

    const result = await staking.totalSupply({
      blockTag: 8826094,
    });
    console.log(result.toString());
    */
  });
