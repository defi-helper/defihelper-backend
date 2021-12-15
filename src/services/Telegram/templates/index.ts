import fs from 'fs';

export const Templates = {
  log: fs.promises.readFile(`${__dirname}/Log.mustache`, 'utf8'),
  eventTemplate: fs.promises.readFile(`${__dirname}/Event.mustache`, 'utf8'),
  welcomeTemplate: fs.promises.readFile(`${__dirname}/Welcome.mustache`, 'utf8'),
  triggerTemplate: fs.promises.readFile(`${__dirname}/Trigger.mustache`, 'utf8'),
  portfolioMetrics: fs.promises.readFile(`${__dirname}/PortfolioMetrics.mustache`, 'utf8'),
  publicBetaStarted: fs.promises.readFile(`${__dirname}/PublicBetaStarted.mustache`, 'utf8'),
  automateNotEnoughFunds: fs.promises.readFile(
    `${__dirname}/AutomateNotEnoughFunds.mustache`,
    'utf8',
  ),
};
