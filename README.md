# ESports Match App

This app crawls [Liquipedia](https://liquipedia.net/dota2/Liquipedia:Upcoming_and_ongoing_matches) upcoming matches and serves the parsed data through a web app. The web app acts as a backend for telegram bot @liqubot.

Telegram bot has tools to query matches and to subscribe to notifications of certain teams matches. These subscription events are also sent to slack via a webhook.

## How to run locally

1. To run locally, create a new file `.env` into the repository root by copying the [.env-template](.env-template).
2. Replace 'missing' values. (It's okay to leave APP_URL and SLACK_URL with the 'missing' value.)
2. Start database docker container and run migrations with `npm run db:start & npm run db:migrate`.
3. Start app with `npm start`

## Development

To create a new database migration run `npm run db:create-migration <name>`, which creates a new file into /migrations folder.

For the migration tool to be able to connect to local database, .env file needs the DATABASE_URL property set (correct value already in [.env-template](.env-template)).

Actual production migrations are run automatically by CI/CD.

## Database

To connect to db in heroku from CLI.

```
heroku login
heroku pg:psql <db-name> --app <app-name>
```

Local database is run in docker container. See details from [docker-compose.yml](docker-compose.yml). Also [.env-template](.env-template) should have the database info set.

To start local database

```
npm run db:start
npm run db:migrate
```

## Deployment

CI/CD is implemented with github actions and push to `main` deploys the app to heroku and runs db migrations.

## Subscription timer

This app uses [kaffeine.herokuapp.com](https://kaffeine.herokuapp.com/) to not sleep during the day and to trigger subscription events on each ping from kaffeine.