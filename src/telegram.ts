import 'source-map-support/register';
import 'module-alias/register';
import container from '@container';

container.logger().info(`Bot is listening`);
container.telegram().startHandler();
