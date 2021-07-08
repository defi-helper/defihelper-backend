import fs from "fs";

export const Templates  = {
    eventTemplate: fs.promises.readFile(`${__dirname}/Event.mustache`, 'utf8')
}
