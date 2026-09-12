import { useEffect, useState } from 'react';

const readStoredValue = (key, initialValue) => {
  try {
    const storedValue = sessionStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : initialValue;
  } catch {
    // A malformed or truncated entry used to throw inside the useState
    // initializer, which crashed the first render into a blank white page with
    // no way for the user to reach a logout button and clear it.
    sessionStorage.removeItem(key);
    return initialValue;
  }
};

export const useSessionStorage = (key, initialValue) => {
  const [value, setValue] = useState(() => readStoredValue(key, initialValue));

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Private-mode or quota errors must not take the app down.
    }
  }, [key, value]);

  return [value, setValue];
};
