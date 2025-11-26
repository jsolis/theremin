
import { UserProfile } from '../types';

// Internal type for storing user data with password (simulated DB record)
interface UserRecord extends UserProfile {
  password: string; 
}

const DB_KEY = 'lumina_users_db';
const SESSION_KEY = 'lumina_user_session';
const MOCK_DELAY = 800;

class AuthService {
  private currentUser: UserProfile | null = null;

  constructor() {
    // Check for existing session
    try {
        const storedSession = localStorage.getItem(SESSION_KEY);
        if (storedSession) {
          this.currentUser = JSON.parse(storedSession);
        }
    } catch (e) {
        console.error("Error restoring session", e);
        localStorage.removeItem(SESSION_KEY);
    }
  }

  getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  // Helper to simulate DB interactions
  private getDatabase(): UserRecord[] {
      try {
          const db = localStorage.getItem(DB_KEY);
          return db ? JSON.parse(db) : [];
      } catch (e) {
          console.error("Error reading user DB", e);
          return [];
      }
  }

  private saveDatabase(users: UserRecord[]) {
      try {
        localStorage.setItem(DB_KEY, JSON.stringify(users));
      } catch (e) {
        console.error("Error saving user DB", e);
        throw new Error("Database storage limit reached");
      }
  }

  async login(email: string, password: string): Promise<UserProfile> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const users = this.getDatabase();
        // Simple case-insensitive email match
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (!user) {
             reject(new Error("Account not found. Please register."));
             return;
        }

        if (user.password !== password) {
            reject(new Error("Incorrect password."));
            return;
        }

        // Create Session (exclude password)
        const userProfile: UserProfile = {
            id: user.id,
            email: user.email,
            name: user.name
        };
        
        this.currentUser = userProfile;
        localStorage.setItem(SESSION_KEY, JSON.stringify(userProfile));
        resolve(userProfile);
      }, MOCK_DELAY);
    });
  }

  async register(email: string, password: string): Promise<UserProfile> {
     return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (!email.includes('@')) {
                 reject(new Error("Please enter a valid email address."));
                 return;
            }

            if (password.length < 6) {
                reject(new Error("Password must be at least 6 characters"));
                return;
            }

            const users = this.getDatabase();
            
            if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
                reject(new Error("Account already exists with this email. Please sign in."));
                return;
            }

            // Create new user record
            const newUser: UserRecord = {
                id: 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
                email: email,
                name: email.split('@')[0],
                password: password // Storing plain text for this frontend-only demo
            };

            try {
                users.push(newUser);
                this.saveDatabase(users);
            } catch (e) {
                reject(new Error("Failed to create account. Storage full."));
                return;
            }

            // Auto login after register
            const userProfile: UserProfile = {
                id: newUser.id,
                email: newUser.email,
                name: newUser.name
            };

            this.currentUser = userProfile;
            localStorage.setItem(SESSION_KEY, JSON.stringify(userProfile));
            resolve(userProfile);

        }, MOCK_DELAY);
     });
  }

  async logout(): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => {
            this.currentUser = null;
            localStorage.removeItem(SESSION_KEY);
            resolve();
        }, 300);
    });
  }
}

export const authService = new AuthService();
