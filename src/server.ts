import 'module-alias/register';
import container from './container';
import { createServer } from 'http';
import Express from 'express';
import { route } from '@api/router';
import { Wallet } from 'ethers';

container.model
  .migrationService()
  .up()
  .then(async () => {
    const express = Express();
    const server = createServer(express);
    route({ express, server });

    const port = container.parent.api.port;
    server.listen(port, () => console.log(`Listen ${port}`));

    /*
    const provider = container.blockchain.ethereum.provider['1']();
    const wallet = new Wallet('0x94770c8449f3fc77bda2fd30fc4f5035ad745f1aa2d82451edf8504644ebdcc2');
    wallet.connect(provider);
    console.log(await wallet.signMessage('hello'));
    */
  });
