/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('whitelist', {
    chat_id: { type: 'integer', primaryKey: true, notNull: true },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  })
  pgm.createTable('subscription', {
    id: 'id',
    chat_id: { type: 'integer', notNull: true, references: '"whitelist"' },
    team: { type: 'varchar(100)', notNull: true },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  })
}

exports.down = pgm => {
  pgm.dropTable('subscription')
  pgm.dropTable('whitelist')
};
