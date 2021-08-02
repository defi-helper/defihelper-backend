import fs from 'fs';

export const Templates = {
  eventTemplate: fs.promises.readFile(`${__dirname}/Event.mustache`, 'utf8'),
  welcomeTemplate: fs.promises.readFile(`${__dirname}/Welcome.mustache`, 'utf8'),
};
