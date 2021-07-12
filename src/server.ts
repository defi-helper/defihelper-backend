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
  });
