import { Injectable } from '@angular/core';
import * as auth0 from 'auth0-js';
import { Router } from '@angular/router';
import { authClientId, authDomain, callbackUrl, auth0Audience } from '../../../environments/environment';
import { Apollo } from 'apollo-angular';
import { QUERY_USER_CHECK } from '@app/shared/queries';
import { MUTATION_ADD_USER } from '@app/shared/mutations';

/**
 * Provides a base for authentication workflow.
 * The Credentials interface as well as login/logout methods should be replaced with proper implementation.
 */
@Injectable()
export class AuthenticationService {
  auth0 = new auth0.WebAuth({
    clientID: authClientId,
    domain: authDomain,
    responseType: 'token id_token',
    audience: auth0Audience,
    redirectUri: callbackUrl,
    scope: 'openid profile email'
  });

  constructor(private router: Router, private apollo: Apollo) {}

  public logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('id_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('expires_at');
    location.reload();
    this.router.navigate(['/login']);
  }

  public isAuthenticated(): boolean {
    const expiresAt = JSON.parse(localStorage.getItem('expires_at') || '{}');
    return new Date().getTime() < expiresAt;
  }
  public login(): void {
    this.auth0.authorize();
  }

  public handleAuthentication(): void {
    this.auth0.parseHash((err: any, authResult: any) => {
      this.apollo
        .watchQuery<any>({
          query: QUERY_USER_CHECK,
          variables: {
            email: authResult.idTokenPayload.email
          }
        })
        .valueChanges.subscribe((res: any) => {
          if (res.data.user.length === 0) {
            this.apollo
              .mutate<any>({
                mutation: MUTATION_ADD_USER,
                variables: {
                  objects: [
                    {
                      email: authResult.idTokenPayload.email,
                      name: authResult.idTokenPayload.name,
                      username: authResult.idTokenPayload.nickname,
                      profile_pic: authResult.idTokenPayload.picture
                    }
                  ]
                }
              })
              .subscribe(data => {
                console.log(data);
              });
          } else {
            localStorage.setItem('user_profile_pic', res.data.user[0].profile_pic);
            localStorage.setItem('username', res.data.user[0].username);
            localStorage.setItem('userId', res.data.user[0].id);
          }
        });
      if (authResult && authResult.accessToken && authResult.idToken) {
        console.log(authResult);
        window.location.hash = '';
        this.setSession(authResult);
        this.router.navigate(['/home']);
      } else if (err) {
        this.router.navigate(['/']);
      }
    });
  }

  private setSession(authResult: any): void {
    const expiresAt = JSON.stringify(authResult.expiresIn * 1000 + new Date().getTime());
    localStorage.setItem('access_token', authResult.accessToken);
    localStorage.setItem('user_id', authResult.idTokenPayload.sub);
    localStorage.setItem('id_token', authResult.idToken);
    localStorage.setItem('expires_at', expiresAt);
  }
}
