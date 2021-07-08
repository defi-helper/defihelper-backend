import fs from "fs";

export const Templates  = {
    confirmEmailTemplate: fs.promises.readFile(`${__dirname}/ConfirmEmail.mustache`, 'utf8'),
}
