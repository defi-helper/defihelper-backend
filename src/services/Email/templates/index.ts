import fs from "fs";

const CONFIRM_EMAIL_TEMPLATE = fs.readFileSync(`${__dirname}/ConfirmEmail.mustache`, 'utf8');

export const Templates  = {
    CONFIRM_EMAIL_TEMPLATE
}
