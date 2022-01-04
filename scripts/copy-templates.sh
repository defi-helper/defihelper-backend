#!/usr/bin/env sh

cp ./src/services/Email/templates/*.mustache ./dist/services/Email/templates/
cp ./src/services/Telegram/templates/*.mustache ./dist/services/Telegram/templates/
cp -r ./src/assets/ ./dist/
