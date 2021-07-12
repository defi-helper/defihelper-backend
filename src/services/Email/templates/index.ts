import fs from 'fs';

export const Templates = {
  confirmEmailTemplate: fs.promises.readFile(`${__dirname}/ConfirmEmail.mustache`, 'utf8'),
  eventTemplate: fs.promises.readFile(`${__dirname}/Event.mustache`, 'utf8'),
};
