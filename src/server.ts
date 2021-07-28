import 'module-alias/register';
import { createServer } from 'http';
import Express from 'express';
import { route } from '@api/router';
import container from './container';

container.model
  .migrationService()
  .up()
  .then(async () => {
    const express = Express();
    const server = createServer(express);
    route({ express, server });

    const { port } = container.parent.api;
    server.listen(port, () => container.logger().info(`Listen ${port}`));

    const telegramService = container.telegram();
    telegramService.startHandler();
  });
