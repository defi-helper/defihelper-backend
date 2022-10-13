import 'source-map-support/register';
import 'module-alias/register';
import { createServer } from 'http';
import Express from 'express';
import { route } from '@api/router';
import container from '@container';

const express = Express();
const server = createServer(express);
route({ express, server });
const { port } = container.parent.api;
server.listen(port, () => container.logger().info(`Listen ${port}`));

(async () => {
  const automateService = container.model.automateService();
  await container.model
    .automateTriggerTable()
    .whereIn(
      'id',
      container.model
        .automateActionTable()
        .column('trigger')
        .where('type', 'ethereumAutomateRun')
        .whereRaw(`params->>'id' = ?`, ['7764d8ec-b86d-4282-b779-f09bfa9517c8']),
    )
    .then((triggers) =>
      Promise.all(triggers.map((trigger) => automateService.deleteTrigger(trigger))),
    );
})();
