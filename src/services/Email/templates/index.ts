import fs from 'fs';

export const Templates = {
  confirmEmailTemplate: fs.promises.readFile(`${__dirname}/ConfirmEmail.mustache`, 'utf8'),
  automateNotEnoughFunds: fs.promises.readFile(
    `${__dirname}/AutomateNotEnoughFunds.mustache`,
    'utf8',
  ),
  eventTemplate: fs.promises.readFile(`${__dirname}/Event.mustache`, 'utf8'),
  triggerTemplate: fs.promises.readFile(`${__dirname}/Trigger.mustache`, 'utf8'),
  portfolioMetrics: fs.promises.readFile(`${__dirname}/PortfolioMetrics.mustache`, 'utf8'),
};
