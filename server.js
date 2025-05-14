// Set up session - needed for passport
app.use(session({
  secret: 'e7d3f8a2c9b5e6d1f3a7c8b4e5d2a9f6c3b8e5d7a2f4c9b3e6d1a8f5c2b7e4',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
})); 