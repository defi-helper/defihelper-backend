import container from '@container';

export default async () => {
  await container.model.userTable().where('timezone', 'Atlantic/Reykjavik').update({
    timezone: 'UTC',
  });
};
