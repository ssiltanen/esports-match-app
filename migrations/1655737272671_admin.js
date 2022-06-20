/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('whitelist', {
    'is_admin': { type: 'boolean', notNull: true, default: false },
  })
};

exports.down = (pgm) => {
  pgm.dropColums('whitelist', ['is_admin'])
};
