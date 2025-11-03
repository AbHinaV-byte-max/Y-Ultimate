'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, onSnapshot } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

interface UserProfileState {
  userProfile: any | null;
  isProfileLoading: boolean;
  profileError: Error | null;
}

export interface FirebaseContextState {
  areServicesAvailable: boolean;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
  userProfile: any | null;
  isProfileLoading: boolean;
  profileError: Error | null;
}

export interface UserHookResult {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
  userProfile: any | null;
  isProfileLoading: boolean;
  profileError: Error | null;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true,
    userError: null,
  });

  const [userProfileState, setUserProfileState] = useState<UserProfileState>({
    userProfile: null,
    isProfileLoading: true,
    profileError: null,
  });

  useEffect(() => {
    if (!auth) {
      setUserAuthState({ user: null, isUserLoading: false, userError: new Error("Auth service not provided.") });
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUserAuthState({ user: firebaseUser, isUserLoading: false, userError: null });
      },
      (error) => {
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      }
    );
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (!firestore || !userAuthState.user) {
      // If there's no user, there's no profile to load.
      // Set loading to false and clear any previous profile.
      setUserProfileState({ userProfile: null, isProfileLoading: false, profileError: null });
      return;
    }
    
    // Start loading the profile for the new user.
    setUserProfileState(prevState => ({ ...prevState, isProfileLoading: true }));
    const userDocRef = doc(firestore, 'users', userAuthState.user.uid);

    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnap) => {
        setUserProfileState({
          userProfile: docSnap.exists() ? docSnap.data() : null,
          isProfileLoading: false,
          profileError: null,
        });
      },
      (error) => {
        console.error("FirebaseProvider: User profile snapshot error:", error);
        setUserProfileState({ userProfile: null, isProfileLoading: false, profileError: error });
      }
    );
    // Unsubscribe when the user logs out or the component unmounts.
    return () => unsubscribe();
  }, [firestore, userAuthState.user]); // Re-run effect only when the user object itself changes.

  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      user: userAuthState.user,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
      userProfile: userProfileState.userProfile,
      isProfileLoading: userProfileState.isProfileLoading,
      profileError: userProfileState.profileError,
    };
  }, [firebaseApp, firestore, auth, userAuthState, userProfileState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};


export const useFirebase = (): FirebaseContextState => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }
  
  return context;
};

export const useAuth = (): Auth | null => {
  const { auth } = useFirebase();
  return auth;
};

export const useFirestore = (): Firestore | null => {
  const { firestore } = useFirebase();
  return firestore;
};

export const useFirebaseApp = (): FirebaseApp | null => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  const memoized = useMemo(factory, deps);
  
  if (memoized && typeof memoized === 'object') {
    Object.defineProperty(memoized, '__memo', {
      value: true,
      writable: false,
      configurable: true,
      enumerable: false
    });
  }
  
  return memoized;
}

export const useUser = (): UserHookResult => {
  const { user, isUserLoading, userError, userProfile, isProfileLoading, profileError } = useFirebase();
  return { user, isUserLoading, userError, userProfile, isProfileLoading, profileError };
};