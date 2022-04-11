import container from '@container';

export default async () => {
  const database = container.database();
  await database.raw(`
      CREATE INDEX protocol_contract_debank_address
        ON protocol_contract_debank (address);

      ALTER TABLE protocol_contract_debank
        DROP CONSTRAINT protocol_contract_debank_address_unique;
  `);
};
