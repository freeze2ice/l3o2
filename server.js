#!/usr/bin/env node

var express = require('express')
    , app = express()
    , mongojs = require('mongojs')
	, url = process.env.MONGOHQ_URL || 'mongodb://localhost/concertdacote'
	, db = mongojs(url, ['concerts'])
	, flash = require('connect-flash')
	, passport = require('passport')
	, LocalStrategy = require('passport-local').Strategy
	, db2 = mongojs(url, ['htpasswd'])
	, bcrypt = require('bcrypt');

app.use(express.static(__dirname+'/'));
// configure Express
app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.logger());
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.session({ secret: 'keyboard cat' }));
  // Initialize Passport! Also use passport.session() middleware, to support
  // persistent login sessions (recommended).
  app.use(flash());
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
});

// Passport session setup.
// To support persistent login sessions, Passport needs to be able to
// serialize users into and deserialize users out of the session. Typically,
// this will be as simple as storing the user ID when serializing, and finding
// the user by ID when deserializing.
passport.serializeUser(function(user, done) {
  done(null, user['_id']);
});

passport.deserializeUser(function(id, done) {
  findById(id, function (err, user) {
    done(err, user);
  });
});

// Use the LocalStrategy within Passport.
// Strategies in passport require a `verify` function, which accept
// credentials (in this case, a username and password), and invoke a callback
// with a user object. In the real world, this would query a database;
// however, in this example we are using a baked-in set of users.
passport.use(new LocalStrategy(
  function(username, password, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      // Find the user by username. If there is no user with the given
      // username, or the password is not correct, set the user to `false` to
      // indicate failure and set a flash message. Otherwise, return the
      // authenticated `user`.
      findByUsername(username, function(err, user) {
        if (err) { return done(err); }
        if (!user) { return done(null, false, { message: 'Unknown user ' + username }); }
        var passCorrect = bcrypt.compare(encryptPass(password), user.password, function(err, res) { return true });
        if (!passCorrect) { return done(null, false, { message: 'Invalid password' }); }
        return done(null, user);
      })
    });
  }
));

/*
 * getting data from database
 */
app.post('/concert', function(req, res){
	db.concerts.find({ latlong : {
		$near:[parseFloat(req.query.lat), parseFloat(req.query.long)],
		$maxDistance: parseFloat(req.query.rayon)/111.12}}, {},
	{ limit : 5000 },
	function(err, result) {
		console.log(result.length);
		if(err) console.log(err);
		res.send(result); 
	});
});

app.get('/maj', ensureAuthenticated, function(req, res){
	startUpdate();
	res.render('dashbord', {user: req.user, message: 'Update Started!' });
});

app.get('/dashbord', function(req, res){
  res.render('dashbord', { user: req.user, message: ''});
});

app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', { user: req.user });
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user, message: req.flash('error') });
});

app.post('/login',
  passport.authenticate('local', { failureRedirect: '/login', failureFlash: true }),
  function(req, res) {
    res.redirect('/dashbord');
  });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.listen(process.env.PORT || 3000);
console.log('Server listening on port 3000 || ' + process.env.PORT);

function startUpdate(fn){
	var requestLastfm = require('./req-json-lastfm.min');
	requestLastfm.startUpdate();
}

function findById(id, fn) {
  db2.htpasswd.findOne({_id: id}, function(err, results){
    if (results) {
      fn(null, results);
    } else {
      fn(new Error('User ' + id + ' does not exist'));
    }
  });
}

function findByUsername(username, fn) {
  db2.htpasswd.findOne({"username": username}, function(err, results){
    if (results) {
      return fn(null, results);
    }
    return fn(null, null);
  });
}

function encryptPass(pass){
  bcrypt.genSalt(10, function(err, salt) {
    bcrypt.hash(pass, salt, function(err, hash) {
        // Store hash in your password DB.
        //db.htpasswd.update({'username': user}, {$set: {'password': hash},});
        return hash;
      });
  });
}

// Simple route middleware to ensure user is authenticated.
// Use this route middleware on any resource that needs to be protected. If
// the request is authenticated (typically via a persistent login session),
// the request will proceed. Otherwise, the user will be redirected to the
// login page.
function ensureAuthenticated(req, res, next) {
  res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}