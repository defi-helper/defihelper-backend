import fs from "fs";

const EVENT_TEMPLATE = fs.readFileSync(`${__dirname}/Event.mustache`, 'utf8');

export const Templates  = {
    EVENT_TEMPLATE
}
