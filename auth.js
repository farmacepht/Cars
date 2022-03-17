var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var mysql = require('./queryer');

passport.serializeUser(function (user, done) {
	done(null, user.id);
});

passport.deserializeUser(function (id, done) {
	var user;
	mysql.getEntity('users', 'id=' + id).then(users => {
		if(users.length > 0) {
			user = users[0];
		} else {
			user = false;
		}
		done(null, user);
	}).catch(error => {
		user = false;	
		done(null, user);
	});
});


passport.use(new LocalStrategy( {usernameField: 'email'},
	function(email, password, done) {
		var user;
    	mysql.getEntity('users', 'email="' + email + '" AND password="' + password + '"').then(users => {
			if(users.length > 0) {
				user = users[0];
			} else {
				user = false;
			}
			done(null, user);
		}).catch(error => {
			user = false;	
			done(null, user);
		});
  	}
));