import fs from 'fs';
import container from '@container';
import { Locale } from '@services/I18n/container';

const template =
  <T>(templateFile: string) =>
  (params: T, locale: Locale) =>
    fs.promises
      .readFile(`${__dirname}/${templateFile}`, 'utf8')
      .then((v) => container.template.render(v, params, locale));

export const Templates = {
  ConfirmEmail: template<{ email: string; confirmationCode: string }>('ConfirmEmail.mustache'),
  PortfolioMetrics: template<{
    totalNetWorth: string;
    totalEarnedUSD: string;
    /*
    percentageTracked: string;
    percentageEarned: string;
    */
  }>('PortfolioMetrics.mustache'),
  AutomateNotEnoughFunds: template<{}>('AutomateNotEnoughFunds.mustache'),
  EventTemplate: template<{
    eventName: string;
    eventsUrls: string;
    contractName: string;
    contractUrl: string;
    network: string;
  }>('Event.mustache'),
  TriggerTemplate: template<{ message: string }>('Trigger.mustache'),
};
