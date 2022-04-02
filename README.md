oauth2
====

`openssl genrsa 2048 -out private.pem`

`openssl rsa -in private.pem -pubout -outform PEM -out public.pem`

```
/**
 curl localhost:12000/api/v2/eg-resource \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlZWY5YmQwNjBhMTNjOGVhNGYzNTY4MWQ4MWU4MWI3MTMyYTUzNTNjYmUzNzBmNjk4NjFkMjM1NzRlZmFlNjk0MzhlMTg4NTA0NzMyNGUyOTQwYmQ2ZGIyMTQ5NzkxYTIiLCJleHAiOjE2NDg3MzM4MDksImlhdCI6MTY0ODczMzcwOX0.X_BCxCR9IVAYw-vPkRPCSgGu9thTowEDGq1_I4VBmjX8BmZDEUuxh6RG9-lk7dHGH87xNa8yX0KacpKiidHF9k4Fz0A3S3ng8c71MT--r8Ku0YAByUEU-nTUmRhrQDErndvl6gwQ39C7H3i_z_lJg81XvtT3g_JdXEop1T4WI8pl_zcWDHBzUcIk5zxy88RCxAoFXHBQXxzl-G_tZI3gMyCUt8p0kXfbkaKhXd4r5kgbXQZXTO2goSH0mKdnclMeoDLA9uzipIPpULJbJYhxQhrDGA6q2h_ptIJP9UZMe0Ittzr3pK3YvG4KKdUAV8GFdp7YqUPyFxc2B-iKEogBsw"
*/
```