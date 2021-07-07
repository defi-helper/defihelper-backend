import { Container, singleton } from '@services/Container';
import AppContainer from '@container';
import { ACL } from './index';
import { User, Role } from '@models/User/Entity';

export class ACLContainer extends Container<typeof AppContainer> {
  readonly guest = singleton(
    () =>
      new ACL({
        proposal: ['view'],
      }),
  );

  readonly user = singleton(() =>
    ACL.expand(this.guest(), {
      proposal: ['create', 'update-own'],
    }),
  );

  readonly admin = singleton(() =>
    ACL.expand(this.user(), {
      proposal: ['update', 'delete'],
    }),
  );

  readonly byRole = (role: Role) => this[role]();

  readonly byUser = (user?: User) => (user ? this.byRole(user.role) : this.guest());
}
