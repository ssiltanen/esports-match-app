/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.dropConstraint('subscription', 'subscription_chat_id_fkey')

  pgm.alterColumn('whitelist', 'chat_id', {
    type: 'bigint',
    primaryKey: true,
    notNull: true,
  })
  pgm.alterColumn('subscription', 'chat_id', {
    type: 'bigint',
    primaryKey: true,
    notNull: true,
    references: '"whitelist"',
  })
}

exports.down = pgm => {
  pgm.dropConstraint('subscription', 'subscription_chat_id_fkey')

  pgm.alterColumn('whitelist', 'chat_id', {
    type: 'integer',
    primaryKey: true,
    notNull: true,
  })
  pgm.alterColumn('subscription', 'chat_id', {
    type: 'integer',
    primaryKey: true,
    notNull: true,
    references: '"whitelist"',
  })
};