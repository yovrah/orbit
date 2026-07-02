import { useCallback, useEffect, useState } from 'react';
import { db } from '../../db/clientDb';

const KEY = 'home_os_card_visible';

/** Whether the "My PC" hero card shows at the top of Home — persisted so a
 * user who removes it stays removed across reloads. */
export function useOsCardVisibility() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    db.settings.get(KEY).then((row) => {
      if (row?.value === 'false') setVisible(false);
    });
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
    db.settings.put({ key: KEY, value: 'false' });
  }, []);

  const show = useCallback(() => {
    setVisible(true);
    db.settings.put({ key: KEY, value: 'true' });
  }, []);

  return { visible, hide, show };
}
