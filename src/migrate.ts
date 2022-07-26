import 'source-map-support/register';
import 'module-alias/register';
import container from './container';

container.model
  .migrationService()
  .up()
  .then(() => process.exit(0))
  .catch((e) => {
    container.logger().error(e);
    process.exit(1);
  });
