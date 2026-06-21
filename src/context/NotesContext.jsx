import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { encryptNote, decryptNote, hashPin, comparePin, encryptPinWithRecoveryCode, decryptPinWithRecoveryCode } from '../lib/crypto';

const NotesContext = createContext();

export function NotesProvider({ children }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [rawNotes, setRawNotes] = useState([]);
  const [unlockedPin, setUnlockedPin] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const formatNote = useCallback((note) => {
    if (!note) return null;
    return {
      ...note,
      isProtected: note.is_protected,
      pinHash: note.pin_hash,
      encryptedTitle: note.encrypted_title,
      encryptedContent: note.encrypted_content,
      salt: note.salt,
      iv: note.iv,
      encryptedPin: note.encrypted_pin,
      recoverySalt: note.recovery_salt,
      recoveryIv: note.recovery_iv,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    };
  }, []);

  // Clear unlocked PIN and profile when user logs out/changes
  useEffect(() => {
    setUnlockedPin(null);
    setProfile(null);
    setLoadingProfile(true);
  }, [user]);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }
    setLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setProfile(data);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [user, fetchProfile]);

  // Auto-migration of legacy data
  useEffect(() => {
    const migrateLegacyRecoveryDetails = async () => {
      if (!user?.id || loadingProfile || profile || rawNotes.length === 0) return;

      // Find if any note has legacy recovery details
      const legacyNote = rawNotes.find(
        (n) => n.isProtected && n.encryptedPin && n.recoverySalt && n.recoveryIv && n.pinHash
      );

      if (legacyNote) {
        console.log('Found legacy recovery details in note, auto-migrating to user profile...');
        try {
          const newProfile = {
            user_id: user.id,
            recovery_code_hash: null, // Nullable initially for legacy
            encrypted_pin: legacyNote.encryptedPin,
            recovery_salt: legacyNote.recoverySalt,
            recovery_iv: legacyNote.recoveryIv,
            pin_hash: legacyNote.pinHash,
          };

          const { data, error } = await supabase
            .from('profiles')
            .insert([newProfile])
            .select()
            .single();

          if (!error && data) {
            console.log('Successfully auto-migrated legacy recovery details to profiles.');
            setProfile(data);
          } else {
            console.error('Error auto-migrating legacy recovery details to profiles:', error);
          }
        } catch (err) {
          console.error('Unexpected error auto-migrating legacy recovery details:', err);
        }
      }
    };

    migrateLegacyRecoveryDetails();
  }, [user?.id, profile, loadingProfile, rawNotes]);

  const createProfile = useCallback(async (pin, recoveryCode) => {
    if (!user?.id) throw new Error('User not authenticated');

    console.log('Creating user profile with recovery code...');
    const encrypted = await encryptPinWithRecoveryCode(pin, recoveryCode);
    const recoveryCodeHash = hashPin(recoveryCode);
    const pinHash = hashPin(pin);

    const newProfile = {
      user_id: user.id,
      recovery_code_hash: recoveryCodeHash,
      encrypted_pin: encrypted.encryptedPin,
      recovery_salt: encrypted.recoverySalt,
      recovery_iv: encrypted.recoveryIv,
      pin_hash: pinHash,
    };

    const { data, error } = await supabase
      .from('profiles')
      .insert([newProfile])
      .select()
      .single();

    if (error) {
      console.error('Error inserting profile:', error);
      throw error;
    }

    localStorage.setItem('safescribe_pin_length', pin.length.toString());
    setProfile(data);
    return data;
  }, [user?.id]);

  const recoverPin = useCallback(async (recoveryCode) => {
    if (!profile) {
      throw new Error('No PIN profile found.');
    }

    const formattedCode = recoveryCode.trim().toUpperCase();

    if (profile.recovery_code_hash) {
      const match = comparePin(formattedCode, profile.recovery_code_hash);
      if (!match) {
        throw new Error('Invalid Recovery Code.');
      }
    }

    try {
      const decryptedPin = await decryptPinWithRecoveryCode(
        profile.encrypted_pin,
        profile.recovery_salt,
        profile.recovery_iv,
        formattedCode
      );

      localStorage.setItem('safescribe_pin_length', decryptedPin.length.toString());

      if (!profile.recovery_code_hash) {
        const recoveryCodeHash = hashPin(formattedCode);
        const { data, error } = await supabase
          .from('profiles')
          .update({ recovery_code_hash: recoveryCodeHash })
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) {
          console.error('Failed to save recovery code hash:', error);
        } else if (data) {
          setProfile(data);
        }
      }

      return decryptedPin;
    } catch (err) {
      console.error('Decryption with recovery code failed:', err);
      throw new Error('Invalid Recovery Code. Please verify and try again.');
    }
  }, [profile, user?.id]);

  const changePin = useCallback(async (recoveryCode, newPin) => {
    if (!user?.id) throw new Error('User not authenticated');
    if (!profile) throw new Error('No PIN profile found');

    const formattedCode = recoveryCode.trim().toUpperCase();

    let isCodeValid = false;
    if (profile.recovery_code_hash) {
      isCodeValid = comparePin(formattedCode, profile.recovery_code_hash);
    } else {
      try {
        await decryptPinWithRecoveryCode(
          profile.encrypted_pin,
          profile.recovery_salt,
          profile.recovery_iv,
          formattedCode
        );
        isCodeValid = true;
      } catch (err) {
        isCodeValid = false;
      }
    }

    if (!isCodeValid) {
      throw new Error('Invalid Recovery Code.');
    }

    let currentPin;
    try {
      currentPin = await decryptPinWithRecoveryCode(
        profile.encrypted_pin,
        profile.recovery_salt,
        profile.recovery_iv,
        formattedCode
      );
    } catch (err) {
      throw new Error('Failed to decrypt current PIN. Recovery code might be invalid.');
    }

    const protectedRawNotes = rawNotes.filter(n => n.isProtected);
    console.log(`Re-encrypting ${protectedRawNotes.length} notes with the new PIN...`);

    const updatedNotes = [];
    for (const note of protectedRawNotes) {
      try {
        const decrypted = await decryptNote(
          note.encryptedTitle,
          note.encryptedContent,
          note.salt,
          note.iv,
          currentPin
        );

        const encrypted = await encryptNote(
          decrypted.title,
          decrypted.content,
          newPin
        );

        const { data, error } = await supabase
          .from('notes')
          .update({
            title: null,
            content: null,
            encrypted_title: encrypted.encryptedTitle,
            encrypted_content: encrypted.encryptedContent,
            salt: encrypted.salt,
            iv: encrypted.iv,
            pin_hash: hashPin(newPin),
            encrypted_pin: null,
            recovery_salt: null,
            recovery_iv: null,
          })
          .eq('id', note.id)
          .select()
          .single();

        if (error) {
          throw error;
        }

        updatedNotes.push(formatNote(data));
      } catch (err) {
        console.error(`Failed to re-encrypt note ${note.id}:`, err);
        throw new Error(`Failed to re-encrypt note "${note.title || 'Untitled'}". PIN change aborted.`);
      }
    }

    const encryptedPinRes = await encryptPinWithRecoveryCode(newPin, formattedCode);

    const recoveryCodeHash = profile.recovery_code_hash || hashPin(formattedCode);
    const newPinHash = hashPin(newPin);

    const { data: updatedProfile, error: profileError } = await supabase
      .from('profiles')
      .update({
        encrypted_pin: encryptedPinRes.encryptedPin,
        recovery_salt: encryptedPinRes.recoverySalt,
        recovery_iv: encryptedPinRes.recoveryIv,
        pin_hash: newPinHash,
        recovery_code_hash: recoveryCodeHash,
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (profileError) {
      throw new Error(`Failed to update profile: ${profileError.message}`);
    }

    localStorage.setItem('safescribe_pin_length', newPin.length.toString());
    setProfile(updatedProfile);
    setUnlockedPin(newPin);

    if (updatedNotes.length > 0) {
      setRawNotes(prev =>
        prev.map(n => {
          const updated = updatedNotes.find(un => un.id === n.id);
          return updated || n;
        })
      );
    }

    console.log('PIN changed and notes re-encrypted successfully.');
  }, [user?.id, profile, rawNotes, formatNote]);



  // Reload raw notes when user changes
  useEffect(() => {
    const fetchNotes = async () => {
      if (!user?.id) {
        setRawNotes([]);
        return;
      }

      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error) {
        setRawNotes(data.map(formatNote));
      }
    };

    fetchNotes();
  }, [user, formatNote]);
  const decryptAllNotes = useCallback(async (list, userId, pin) => {
    if (!userId) return [];

    return await Promise.all(
      list.map(async (note) => {
        let decryptedTitle = '';
        let decryptedContent = '';

        if (note.isProtected) {
          if (pin) {
            try {
              if (note.encryptedTitle || note.encryptedContent) {
                const decrypted = await decryptNote(
                  note.encryptedTitle,
                  note.encryptedContent,
                  note.salt,
                  note.iv,
                  pin
                );
                decryptedTitle = decrypted.title;
                decryptedContent = decrypted.content;
              } else if (note.encryptedContent) {
                // Legacy protected content only
                const decrypted = await decryptNote(
                  null,
                  note.encryptedContent,
                  note.salt,
                  note.iv,
                  pin
                );
                decryptedContent = decrypted.content;
              }
            } catch (err) {
              const pinMatchesNoteHash = note.pinHash ? comparePin(pin, note.pinHash) : true;
              if (!pinMatchesNoteHash) {
                console.warn(`Note ${note.id} was encrypted with a different PIN than the current session PIN.`);
              } else {
                console.error('Error decrypting protected note:', note.id, err);
              }
              decryptedTitle = 'Error Decrypting';
              decryptedContent = '';
            }
          } else {
            decryptedTitle = 'Protected Note';
            decryptedContent = '';
          }
        } else {
          // Unprotected note
          if (note.encryptedTitle || note.encryptedContent) {
            try {
              const decrypted = await decryptNote(
                note.encryptedTitle,
                note.encryptedContent,
                note.salt,
                note.iv,
                userId
              );
              decryptedTitle = decrypted.title;
              decryptedContent = decrypted.content;
            } catch (err) {
              console.error('Error decrypting unprotected note:', note.id, err);
              decryptedTitle = 'Error Decrypting';
              decryptedContent = '';
            }
          }
        }

        return {
          ...note,
          decryptedTitle,
          decryptedContent,
        };
      })
    );
  }, []);
  const migrateLegacyNotes = useCallback(async (decryptedList, userId, pin) => {
    if (!userId || decryptedList.length === 0) return;

    // A note needs migration if it doesn't have an encrypted title yet (so encryptedTitle is null)
    const toMigrate = decryptedList.filter(note => {
      const needsMigration = note.encryptedTitle === null || note.encryptedTitle === undefined;
      if (!needsMigration) return false;
      if (note.isProtected) {
        return !!pin; // only migrate protected if we have the pin
      }
      return true; // migrate unprotected immediately
    });

    if (toMigrate.length === 0) return;

    console.log(`Starting client-side migration for ${toMigrate.length} notes...`);
    const updatedNotesMap = {};

    for (const note of toMigrate) {
      try {
        const keyMaterial = note.isProtected ? pin : userId;
        const { encryptedTitle, encryptedContent, salt, iv } = await encryptNote(
          note.title || '',
          note.content || '',
          keyMaterial
        );

        const { data, error } = await supabase
          .from('notes')
          .update({
            title: null,
            content: null,
            encrypted_title: encryptedTitle,
            encrypted_content: encryptedContent,
            salt,
            iv,
          })
          .eq('id', note.id)
          .select()
          .single();

        if (error) {
          console.error(`Failed to migrate note ${note.id}:`, error);
        } else {
          console.log(`Successfully migrated note ${note.id} to encrypted columns.`);
          updatedNotesMap[note.id] = formatNote(data);
        }
      } catch (err) {
        console.error(`Error migrating note ${note.id}:`, err);
      }
    }

    if (Object.keys(updatedNotesMap).length > 0) {
      setRawNotes(prev =>
        prev.map(note => updatedNotesMap[note.id] || note)
      );
    }
  }, [formatNote]);

  // Decryption & Migration Trigger
  useEffect(() => {
    let active = true;
    const runDecryptionAndMigration = async () => {
      if (!user?.id) {
        setNotes([]);
        return;
      }
      const decrypted = await decryptAllNotes(rawNotes, user.id, unlockedPin);
      if (active) {
        setNotes(decrypted);
        migrateLegacyNotes(decrypted, user.id, unlockedPin);
      }
    };
    runDecryptionAndMigration();
    return () => {
      active = false;
    };
  }, [rawNotes, user?.id, unlockedPin, decryptAllNotes, migrateLegacyNotes]);
  const addNote = useCallback(async (note, pin, recoveryCode) => {
    if (!user?.id) throw new Error('User not authenticated');

    const activePin = pin || note.protectionPin;
    let cryptoFields = {};
    if (note.isProtected) {
      if (!activePin) throw new Error('PIN is required for protected notes');
      const { encryptedTitle, encryptedContent, salt, iv } = await encryptNote(note.decryptedTitle, note.decryptedContent, activePin);

      if (!profile && recoveryCode) {
        await createProfile(activePin, recoveryCode);
      }

      const pinHash = hashPin(activePin);

      cryptoFields = {
        encrypted_title: encryptedTitle,
        encrypted_content: encryptedContent,
        salt,
        iv,
        pin_hash: pinHash,
        encrypted_pin: null,
        recovery_salt: null,
        recovery_iv: null,
      };
    } else {
      const { encryptedTitle, encryptedContent, salt, iv } = await encryptNote(note.decryptedTitle, note.decryptedContent, user.id);
      cryptoFields = {
        encrypted_title: encryptedTitle,
        encrypted_content: encryptedContent,
        salt,
        iv,
        pin_hash: null,
        encrypted_pin: null,
        recovery_salt: null,
        recovery_iv: null,
      };
    }

    const { data, error } = await supabase
      .from('notes')
      .insert([
        {
          user_id: user.id,
          type: note.type,
          title: null,
          content: null,
          is_protected: note.isProtected,
          ...cryptoFields
        },
      ])
      .select()
      .single();

    if (error) throw error;

    const formatted = formatNote(data);
    setRawNotes(prev => [formatted, ...prev]);

    return {
      ...formatted,
      decryptedTitle: note.decryptedTitle,
      decryptedContent: note.decryptedContent,
    };
  }, [user, formatNote, profile, createProfile]);

  const updateNote = useCallback(async (id, updates, pin, recoveryCode) => {
    if (!user?.id) throw new Error('User not authenticated');

    const activePin = pin || updates?.protectionPin;
    let cryptoFields = {};
    if (updates.isProtected) {
      if (!activePin) throw new Error('PIN is required for protected notes');
      const { encryptedTitle, encryptedContent, salt, iv } = await encryptNote(updates.decryptedTitle, updates.decryptedContent, activePin);

      if (!profile && recoveryCode) {
        await createProfile(activePin, recoveryCode);
      }

      const pinHash = hashPin(activePin);

      cryptoFields = {
        encrypted_title: encryptedTitle,
        encrypted_content: encryptedContent,
        salt,
        iv,
        pin_hash: pinHash,
        encrypted_pin: null,
        recovery_salt: null,
        recovery_iv: null,
      };
    } else {
      const { encryptedTitle, encryptedContent, salt, iv } = await encryptNote(updates.decryptedTitle, updates.decryptedContent, user.id);
      cryptoFields = {
        encrypted_title: encryptedTitle,
        encrypted_content: encryptedContent,
        salt,
        iv,
        pin_hash: null,
        encrypted_pin: null,
        recovery_salt: null,
        recovery_iv: null,
      };
    }

    const { data, error } = await supabase
      .from('notes')
      .update({
        title: null,
        content: null,
        is_protected: updates.isProtected,
        encrypted_title: cryptoFields.encrypted_title,
        encrypted_content: cryptoFields.encrypted_content,
        salt: cryptoFields.salt,
        iv: cryptoFields.iv,
        pin_hash: cryptoFields.pin_hash,
        encrypted_pin: cryptoFields.encrypted_pin,
        recovery_salt: cryptoFields.recovery_salt,
        recovery_iv: cryptoFields.recovery_iv,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const formatted = formatNote(data);
    setRawNotes(prev =>
      prev.map(note => (note.id === id ? formatted : note))
    );

    return {
      ...formatted,
      decryptedTitle: updates.decryptedTitle,
      decryptedContent: updates.decryptedContent,
    };
  }, [user, profile, createProfile, formatNote]);

  const deleteNote = useCallback(async (id) => {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (error) throw error;

    setRawNotes(prev => prev.filter(note => note.id !== id));
  }, []);

  const toggleProtection = useCallback(async (id, isProtected, pin, recoveryCode, plainTextTitle, plainTextContent) => {
    if (!user?.id) throw new Error('User not authenticated');

    let cryptoFields = {};
    if (isProtected) {
      if (!pin) throw new Error('PIN is required to protect notes');
      const { encryptedTitle, encryptedContent, salt, iv } = await encryptNote(plainTextTitle, plainTextContent, pin);

      if (!profile && recoveryCode) {
        await createProfile(pin, recoveryCode);
      }

      const pinHash = hashPin(pin);

      cryptoFields = {
        encrypted_title: encryptedTitle,
        encrypted_content: encryptedContent,
        salt,
        iv,
        pin_hash: pinHash,
        encrypted_pin: null,
        recovery_salt: null,
        recovery_iv: null,
      };
    } else {
      const { encryptedTitle, encryptedContent, salt, iv } = await encryptNote(plainTextTitle, plainTextContent, user.id);
      cryptoFields = {
        encrypted_title: encryptedTitle,
        encrypted_content: encryptedContent,
        salt,
        iv,
        pin_hash: null,
        encrypted_pin: null,
        recovery_salt: null,
        recovery_iv: null,
      };
    }

    const { data, error } = await supabase
      .from('notes')
      .update({
        title: null,
        content: null,
        is_protected: isProtected,
        encrypted_title: cryptoFields.encrypted_title,
        encrypted_content: cryptoFields.encrypted_content,
        salt: cryptoFields.salt,
        iv: cryptoFields.iv,
        pin_hash: cryptoFields.pin_hash,
        encrypted_pin: cryptoFields.encrypted_pin,
        recovery_salt: cryptoFields.recovery_salt,
        recovery_iv: cryptoFields.recovery_iv,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const formatted = formatNote(data);
    setRawNotes(prev =>
      prev.map(n => (n.id === id ? formatted : n))
    );

    return {
      ...formatted,
      decryptedTitle: plainTextTitle,
      decryptedContent: plainTextContent,
    };
  }, [user, profile, createProfile, formatNote]);

  return (
    <NotesContext.Provider value={{
      notes,
      addNote,
      updateNote,
      deleteNote,
      toggleProtection,
      unlockedPin,
      setUnlockedPin,
      profile,
      loadingProfile,
      recoverPin,
      changePin
    }}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const context = useContext(NotesContext);
  if (!context) throw new Error('useNotes must be used within NotesProvider');
  return context;
}
