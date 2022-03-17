const SYSTEM_ERROR_HEAD = 'В системе - СБОЙ!';
const E404_ERROR_HEAD = 'Страница не обнаружена!';
const SERVER_PORT = 3000;
const SELECT_USERMEDALS = 'SELECT * FROM medals JOIN usermedals ON medals.id=usermedals.medalD WHERE usermedals.userID=';
const SELECT_USER_AND_CARPART = 'SELECT carparts.*, users.fullName FROM carparts JOIN users ON carparts.userID=users.id WHERE carparts.id=';
const SELECT_COMMENTS_P1 = 'SELECT comments.*, users.fullName, COUNT(likes.id) as quantity FROM comments LEFT JOIN likes ON comments.id=likes.commentID JOIN users ON users.id=comments.userID WHERE comments.carpartID=';
const SELECT_COMMENTS_P2 = ' GROUP BY comments.id ORDER BY comments.id DESC';
const SELECT_CARPARTS_OF_ORDER = 'select carparts.* from carparts join ordercarparts on carparts.id = ordercarparts.carpartID where ordercarparts.orderID=';
const SELECT_BEST_TAGS = 'SELECT tagName FROM carparttags GROUP BY tagName ORDER BY COUNT(*) DESC'
const SELECT_ORDER_USER = 'SELECT users.email FROM users JOIN orders ON users.id = orders.userID WHERE orders.id='
const SELECT_ORDER_CARPARTS= 'select * from ordercarparts join carparts on ordercarparts.carpartID = carparts.id where ordercarparts.orderID='
const SELECT_ORDER_PRICE= 'select sum(carparts.price) as pricecount from carparts join ordercarparts on carparts.id=ordercarparts.carpartID join orders on orders.id=ordercarparts.orderID where orders.id='
const FULL_TEXT_QUERY = "SELECT carparts.* FROM carparts LEFT JOIN comments ON carparts.id = comments.carpartID LEFT JOIN `carparttags` ON `carparts`.id = `carparttags`.carpartID WHERE (MATCH (`comments`.`text`) AGAINST ('TO_REPLACE')) OR (MATCH (`carparts`.`name`, `carparts`.`shortText`) AGAINST ('TO_REPLACE')) OR (MATCH (`carparttags`.`tagName`) AGAINST ('TO_REPLACE')) GROUP BY carparts.id"


var express = require('express');
var app = express();
app.set('view engine', 'ejs');
var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({extended: false});
var mysql = require('./queryer');
var session = require('express-session');
var FileStore = require('session-file-store')(session);
var passport = require('passport');
var crypto = require('crypto');
const sendmail = require('sendmail')();
var messages =require('./messages');
const phantom = require('phantom');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
var Localize = require('localize');
var myLocalize = new Localize(JSON.parse(require('fs').readFileSync(__dirname + "/locale/locales.json", "utf8")));
var fs = require('fs');

Date.prototype.toISO = function() {
    var mm = this.getMonth() + 1;
    var dd = this.getDate();

    return [
        this.getFullYear(),
        (mm>9 ? '' : '0') + mm,
        (dd>9 ? '' : '0') + dd
    ].join('-');
};
String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};
app.use('/public', express.static('public'));

app.use(
    session({
        secret: 'HelloMMM',
        store: new FileStore(),
        cookie: {
            path: '/',
            httpOnly: true,
            maxAge: 3*60*60*1000,
        },
        resave: false,
        saveUninitialized: false,
    })
);

app.use(passport.initialize({}));
app.use(passport.session({}));

require('./auth');

app.use(function(req, res, next){
    myLocalize.setLocale("RU");
    if(req.session.passport == undefined) {
        next();
    } else if(req.session.passport.user == undefined) {
        app.locals.user = null;
        next();
    } else {
        mysql.getEntity('users', 'id=' + req.session.passport.user).then(users => {
            app.locals.user = users[0];
            myLocalize.setLocale(app.locals.user.language);
            next();
        }).catch(error => {
            res.render('error', {error: error, title: SYSTEM_ERROR_HEAD, myLocalize: myLocalize});
        });
    }
});

var createToken = function () {
    var current_date = (new Date()).valueOf().toString();
    var random = Math.random().toString();
    return crypto.createHash('sha1').update(current_date + random).digest('hex');
}


//Главные страницы

app.get('/', function (req, res) {
    mysql.getEntity('carparts', '', 'id desc', '3').then(newEntitys => {
        mysql.getEntity('carparts', '', 'ranking desc', '3').then(bestEntitys => {
            res.render('index', {newEntitys: newEntitys, bestEntitys: bestEntitys, user: app.locals.user, myLocalize: myLocalize});
        }).catch(error => {
            res.render('error', {error: error, title: SYSTEM_ERROR_HEAD, myLocalize: myLocalize});
        });
    }).catch(error => {
        res.render('error', {error: error, title: SYSTEM_ERROR_HEAD, myLocalize: myLocalize});
    });
});

app.get('/api/', function (req, res) {
    mysql.getEntity('carparts', '', 'id desc', '3').then(newEntitys => {
        mysql.getEntity('carparts', '', 'ranking desc', '3').then(bestEntitys => {
            res.json({newEntitys: newEntitys, bestEntitys: bestEntitys, user: app.locals.user, myLocalize: myLocalize});
        }).catch(error => {
            res.render('error', {error: error, title: SYSTEM_ERROR_HEAD, myLocalize: myLocalize});
        });
    }).catch(error => {
        res.render('error', {error: error, title: SYSTEM_ERROR_HEAD, myLocalize: myLocalize});
    });
});


app.get('/about', urlencodedParser, function (req, res) {
    res.render('about', {user: app.locals.user, myLocalize: myLocalize});
});

app.get('/api/about', urlencodedParser, function (req, res) {
    res.json({user: app.locals.user, myLocalize: myLocalize});
});

app.get('/payment', urlencodedParser, function (req, res) {
    res.render('payment', {user: app.locals.user, myLocalize: myLocalize});
});

app.get('/api/payment', urlencodedParser, function (req, res) {
    res.json({user: app.locals.user, myLocalize: myLocalize});
});

app.get('/pickup', urlencodedParser, function (req, res) {
    res.render('pickup', {user: app.locals.user, myLocalize: myLocalize});
});

app.get('/api/pickup', urlencodedParser, function (req, res) {
    res.json({user: app.locals.user, myLocalize: myLocalize});
});


var componentToHex = function (c) {
    var hex = Number(c).toString(16); 
    return hex.length == 1 ? "0" + hex : hex;
}

var rgb2hex = function(string) {
    var arr = string.substr(4, string.length-5).split(',');
    var r = arr[0].toString(16);
    var g = arr[1].toString(16);
    var b = arr[2].toString(16);
    var hex = "#" + componentToHex(r) +componentToHex(g) + componentToHex(b);
    return hex.replaceAll(' ', '');
}

//Аутентификация

var authFun = function (req, res, next) {
    if(req.isAuthenticated()){
        if(req.path == '/auth') res.redirect('/');              
        else next();    
    } else {
        if(req.path == '/auth') next();
        else res.redirect('/auth');     
    }
}

var verifyFun = function (req, res, next) {
    if(!req.isAuthenticated()) res.redirect('/');
    mysql.getEntity('users', 'id=' + req.session.passport.user).then(users => {
        if(users[0].verify == 0 && req.path != '/verify') {
            res.redirect('/verify');
        } else if (users[0].verify != 0 && req.path == '/verify'){
            res.redirect('/');
        }
        next();
    }).catch(error => {
        res.render('error', {error: error, title: SYSTEM_ERROR_HEAD, myLocalize: myLocalize});
    });
}

var authMessage = '';
var doAuth = function (req, res, path) {
    passport.authenticate('local', function(err, user, info) {
        if (err) {
            res.render('error', {error: err, title: SYSTEM_ERROR_HEAD, myLocalize: myLocalize});
        }
        if (!user) {
            authMessage = "Некорректный логин\\пароль!";
            return res.redirect('/auth'); 
        }
        req.logIn(user, function(err) {
            if (err) { 
                res.render('error', {error: err, title: SYSTEM_ERROR_HEAD, myLocalize: myLocalize});
            }
            return res.redirect(path);
        });
    })(req, res);
}

var doMail = function (mailTo, message) {
    sendmail({ 
        from: 'admin.mmm@yourdomain.com', 
        to: mailTo, 
        subject: message.head, 
        html: message.body, 
    }, function(err, reply) {}); 
}

app.get('/auth', urlencodedParser, authFun, function (req, res) {
    var message = authMessage;
    authMessage = "";
    res.render('auth', {isRegistry: req.query.reg, user: app.locals.user, myLocalize: myLocalize, authMessage: message});
});

app.get('/api/auth', urlencodedParser, authFun, function (req, res) {
    var message = authMessage;
    authMessage = "";
    res.json( {isRegistry: req.query.reg, user: app.locals.user, myLocalize: myLocalize, authMessage: message});
});

app.get('/search', urlencodedParser, function (req, res) {
    if(req.query.value != undefined && req.query.value != '') {
        var query = FULL_TEXT_QUERY.split('TO_REPLACE').join(req.query.value);
        mysql.getByQuery(query).then(carparts => {
             res.render('search', {user: app.locals.user, query: req.query.value, carparts: carparts, myLocalize: myLocalize});
           // res.json({user: app.locals.user, query: req.query.value, carparts: carparts, myLocalize: myLocalize});
        }).catch(error => {
            res.redirect('/');
        });
    } else{
        res.redirect('/');
    }
});

app.get('/api/search', urlencodedParser, function (req, res) {
    if(req.query.value != undefined && req.query.value != '') {
        var query = FULL_TEXT_QUERY.split('TO_REPLACE').join(req.query.value);
        mysql.getByQuery(query).then(carparts => {
            //res.render('search', {user: app.locals.user, query: req.query.value, carparts: carparts, myLocalize: myLocalize});
            res.json({user: app.locals.user, query: req.query.value, carparts: carparts, myLocalize: myLocalize});
        }).catch(error => {
            res.redirect('/');
        });
    } else{
        res.redirect('/');
    }
});

app.get('/basket', urlencodedParser, function (req, res) {
    if(req.session.order != null) {
        mysql.getEntity('orders', 'id=' + req.session.order).then(orders => {
            mysql.getByQuery(SELECT_ORDER_CARPARTS + req.session.order).then(ordercarparts => {
                mysql.getByQuery(SELECT_ORDER_PRICE + req.session.order).then(price => {
                    res.render('basket', {user: app.locals.user, ordercarparts: ordercarparts, order: orders[0], price: price[0].pricecount, myLocalize: myLocalize});
                }).catch(error => {
                    console.log(216, error);
                    // res.redirect('/');
                });
            }).catch(error => {
                console.log(220, error);
                // res.redirect('/');
            });
        }).catch(error => {
            console.log(224, error);
            // res.redirect('/');
        });
    } else{
        console.log(123);
        res.redirect('/');
    }
});

app.post('/auth', urlencodedParser, function (req, res) {
    var path = req.session.passport == undefined ? '/' : '/users/' + req.session.passport.user;
    return doAuth(req, res, path);
});

var createUser = function (body, token) {
    return {
        email: body.email,
        password: body.password,
        role: 0,
        fullName: body.fullName,
        dateOfBirth: body.date,
        language: body.language,
        theme: body.theme,
        veriryd: 0,
        token: token
    }
}
app.post('/registry', urlencodedParser, function (req, res) {
    var token = createToken();
    var user = createUser(req.body, token);
    mysql.insertEntity('users', user).then(result => {
        messages.verifyMessage.body = messages.verifyMessage.body.replace("TO_REPLACE", token);
        doMail(user.email, messages.verifyMessage);
        return doAuth(req, res, '/verify');
    }).catch(error => {
       res.render('error', {error: error, title: SYSTEM_ERROR_HEAD, myLocalize: myLocalize});
    });
});

const getLastDate = function (month) {
    const date = new Date();
    date.setMonth(date.getMonth() + month);
    return date;
}

app.get('/excel', urlencodedParser, function (req, res) {
    const lastDate =  'created_at>"' + getLastDate(-req.query.month).toISOString().replace('Z', '') + '"';
    console.log(lastDate);
    mysql.getEntity('orders', lastDate).then(async orders => {
        // console.log(orders, req.query.month);
        const newOrders = [];

        let pCount = 0;
        let pPrice = 0;
        for (const order of orders) {
            const ordercarparts = (await mysql.getByQuery(SELECT_ORDER_CARPARTS + order.id)).map(product => {
                pCount += Number.parseInt(product.quantity);
                pPrice += product.price * product.quantity;
                return product.name + ', ';
            });

            const products = ordercarparts.reduce((c,p) => c + p, '');
            newOrders.push(`${new Date(order.created_at).toLocaleDateString() || ''};${order.address};${order.phone};${order.userID};${products};\r\n`);
        }

        res.setHeader('Content-Encoding', 'UTF-8');
        res.setHeader('Content-Type', 'text/csv; charset=UTF-8');
        res.setHeader('Content-Disposition', 'attachment; filename="Report-Orders.csv"');

        fs.writeFileSync(__dirname + '/data.csv',"\ufeff" +
          `Месяцы:; ${req.query.month}; Заказы:; ${orders.length}; Товары:; ${pCount}; Выручка:; (${pPrice} BYN)\r\n` +
          '\r\n' +
          'Дата; Адрес; Телефон; НомерПользователя; Товары;\r\n' +
          newOrders.reduce((previousValue, currentValue) => {
              return previousValue + currentValue;
          }, ''),
          {encoding: 'utf8'}
        );

        res.sendFile(__dirname + "/data.csv");
    }).catch(error => {
        console.log(error);
        // res.redirect('/');
    });
});

// app.get('/users/' + req.session.passport.user, urlencodedParser, authFun, verifyFun, function (req, res) {
//     res.redirect('/users/' + req.session.passport.user);
// });


app.get('/users/:index', urlencodedParser, authFun, verifyFun, function (req, res) {
    mysql.getEntity('users', 'id=' + req.params.index + ' OR id=' + req.session.passport.user).then(users => {
        mysql.getEntity('carparts', 'userID=' + req.params.index).then(carparts => {
            if(users.length < 1){
                res.redirect('/');
            } else {
                var user = users[0].id ==  req.session.passport.user ? users[0]: users[1];
                var thisUser = users[0].id ==  req.session.passport.user ? users[1]: users[0];
                thisUser = thisUser == undefined ? user : thisUser;
                mysql.getEntity('users').then(allUsers => {
                    mysql.getByQuery(SELECT_USERMEDALS + user.id).then(medals => {
                        // user.dateOfBirth  = user.dateOfBirth.toISO();
                        res.render('userpanel', {user: user, carparts: carparts, allUsers: allUsers, thisUser: thisUser, medals: medals, myLocalize: myLocalize});
                    }).catch(error => {
                        res.redirect('/');
                    });
                }).catch(error => {
                    res.redirect('/');
                });
            }
        }).catch(error => {
            res.redirect('/');
        });
    }).catch(error => {
        res.redirect('/');
    });
});

app.get('/api/users/:index', urlencodedParser, authFun, verifyFun, function (req, res) {
    mysql.getEntity('users', 'id=' + req.params.index + ' OR id=' + req.session.passport.user).then(users => {
        mysql.getEntity('carparts', 'userID=' + req.params.index).then(carparts => {
            if(users.length < 1){
                res.redirect('/');
            } else {
                var user = users[0].id ==  req.session.passport.user ? users[0]: users[1];
                var thisUser = users[0].id ==  req.session.passport.user ? users[1]: users[0];
                thisUser = thisUser == undefined ? user : thisUser;
                mysql.getEntity('users').then(allUsers => {
                    mysql.getByQuery(SELECT_USERMEDALS + user.id).then(medals => {
                        // user.dateOfBirth  = user.dateOfBirth.toISO();
                        res.json({user: user, carparts: carparts, allUsers: allUsers, thisUser: thisUser, medals: medals, myLocalize: myLocalize});
                    }).catch(error => {
                        res.redirect('/');
                    });
                }).catch(error => {
                    res.redirect('/');
                });
            }
        }).catch(error => {
            res.redirect('/');
        });
    }).catch(error => {
        res.redirect('/');
    });
});

app.get('/carpart/:index', urlencodedParser, function (req, res) {
        mysql.getByQuery(SELECT_USER_AND_CARPART + req.params.index).then(carparts => {
            mysql.getByQuery(SELECT_USERMEDALS + carparts[0].userID).then(medals => {
                mysql.getEntity('rankings', 'userID=' + (app.locals.user == null ? 0 : app.locals.user.id) + ' AND carpartID=' + carparts[0].id).then(rankings => {
                    mysql.getByQuery(SELECT_COMMENTS_P1 + carparts[0].id + SELECT_COMMENTS_P2).then(comments => {
                        mysql.getEntity('likes', 'userID=' + (app.locals.user == null ? 0 : app.locals.user.id)).then(likes => {
                            mysql.getEntity('carparttags', 'carpartID=' + carparts[0].id).then(tags => {
                                var quantityComment = comments.length;
                                comments = getNeededComments(req.query, comments);
                                res.render('carpart', {user: app.locals.user, carpart: carparts[0], rankings: rankings[0], comments: comments, likes: likesToArrayId(likes), tags: tags, myLocalize: myLocalize, medals: medals, quantityComment:quantityComment, pages: getPages(comments)});
                            }).catch(error => {
                                res.redirect('/');
                            });
                        }).catch(error => {
                            res.redirect('/');
                        });
                    }).catch(error => {
                        res.redirect('/');
                    });
                }).catch(error => {
                    res.redirect('/');
                });
            }).catch(error => {
                res.redirect('/');
            });
        }).catch(error => {
            res.redirect('/');
        });
});

app.get('/api/carpart/:index', urlencodedParser, function (req, res) {
    mysql.getByQuery(SELECT_USER_AND_CARPART + req.params.index).then(carparts => {
        mysql.getByQuery(SELECT_USERMEDALS + carparts[0].userID).then(medals => {
            mysql.getEntity('rankings', 'userID=' + (app.locals.user == null ? 0 : app.locals.user.id) + ' AND carpartID=' + carparts[0].id).then(rankings => {
                mysql.getByQuery(SELECT_COMMENTS_P1 + carparts[0].id + SELECT_COMMENTS_P2).then(comments => {
                    mysql.getEntity('likes', 'userID=' + (app.locals.user == null ? 0 : app.locals.user.id)).then(likes => {
                        mysql.getEntity('carparttags', 'carpartID=' + carparts[0].id).then(tags => {
                            var quantityComment = comments.length;
                            comments = getNeededComments(req.query, comments);
                            res.json({user: app.locals.user, carpart: carparts[0], rankings: rankings[0], comments: comments, likes: likesToArrayId(likes), tags: tags, myLocalize: myLocalize, medals: medals, quantityComment:quantityComment, pages: getPages(comments)});
                        }).catch(error => {
                            res.redirect('/');
                        });
                    }).catch(error => {
                        res.redirect('/');
                    });
                }).catch(error => {
                    res.redirect('/');
                });
            }).catch(error => {
                res.redirect('/');
            });
        }).catch(error => {
            res.redirect('/');
        });
    }).catch(error => {
        res.redirect('/');
    });
});

var getNeededComments = function (query, comments) {
    if(query.page == undefined || query.page > comments.length / 10 + 1) {
        return comments.slice(0, 10);
    } else {
        return comments.splice((query.page-1)*10, (query.page-1)*10 + 10);
    }
}

var getPages = function (comments) {
    var pages = [];
    for (var i = 0; i < comments.length / 10 + 1; i++) {
        pages.push(i);
    }
    return pages;
}

var likesToArrayId = function (likes) {
    var idArray = [];
    for (var like of likes) {
        idArray.push(like.commentID);
    }
    return idArray;
}

app.get('/edit_carpart/:index', urlencodedParser, authFun, verifyFun, function (req, res) {
    mysql.getEntity('carparttags', 'carpartID=' + req.params.index ).then(thisTags =>  {
        mysql.getByQuery(SELECT_BEST_TAGS).then(tags =>  {
            mysql.getEntity('carparts', 'id=' + req.params.index).then(carparts =>  {

                if(req.params.index == 0) {
                        mysql.getEntity('carparts', 'id=' + (req.query.from == null ? 0 : req.query.from)).then(carpartFrom =>  {
                            var fromHtml = ""
                            if(carpartFrom.length > 0) fromHtml = carpartFrom[0].html;
                            res.render('editcarpart', {user: app.locals.user, carpart:  null, tags: tags, thisTags: thisTags, myLocalize: myLocalize, color: ('rgb(0, 255, 0)'), fromHtml: fromHtml });

                        }).catch(error => {
                            res.redirect('/');
                        });
                } else if(carparts.length > 0) {
                    res.render('editcarpart', {user: app.locals.user, carpart:  carparts[0], tags: tags, thisTags: thisTags, myLocalize: myLocalize, color: carparts[0].color });
                } else {
                    res.redirect('/');
                }
            }).catch(error => {
                console.log(error);
                res.redirect('/');
            });
        }).catch(error => {
            res.redirect('/');
        });
    }).catch(error => {
        res.redirect('/');
    });
});


app.get('/logout', urlencodedParser, function (req, res) {
    req.logout();
    res.redirect('/');
});

app.get('/verify', urlencodedParser, verifyFun, function (req, res) {
    res.render('verify', {myLocalize: myLocalize});
});

app.post('/verify', urlencodedParser, function (req, res) {
    if(req.body.button == "newquery") {
        mysql.getEntity('users', 'id=' + req.session.passport.user).then(users => {
            messages.verifyMessage.body = messages.verifyMessage.body.replace("TO_REPLACE", users[0].token);
            doMail(users[0].email, messages.verifyMessage);
            res.render('verify', {myLocalize: myLocalize});
        }).catch(error => {
            res.render('error', {error: error, title: SYSTEM_ERROR_HEAD, myLocalize: myLocalize});
        });
    } else if(req.body.button == "remove") {
        mysql.deleteEntity('users', 'id=' + req.session.passport.user).then(result => {
            req.logout();
            res.redirect('/');
        }).catch(error => {
            res.render('error', {error: error, title: SYSTEM_ERROR_HEAD, myLocalize: myLocalize});
        });
    } else {
        res.render('error', {error: "Request Body is not valid!", title: SYSTEM_ERROR_HEAD, myLocalize: myLocalize});
    }
});


app.get('/tokenverify/:tokenid', urlencodedParser, function (req, res) {
    mysql.getEntity('users', 'token="' + req.params.tokenid + '"').then(users => {
        var user = users[0];
        user.verify = 1;
        user.dateOfBirth  = user.dateOfBirth.toISO();
        mysql.updateEntity('users', user.id, user).then(result => {
            req.body.email = user.email;
            req.body.password = user.password;
            return doAuth(req, res, '/users/' + req.session.passport.user);
        }).catch(error => {
            res.render('error', {error: error, title: SYSTEM_ERROR_HEAD, myLocalize: myLocalize});
        });
    }).catch(error => {
        res.render('error', {error: error, title: SYSTEM_ERROR_HEAD, myLocalize: myLocalize});
    });
});

// For: AJAX

app.post('/savesetting', urlencodedParser, function (req, res) {
    res.send( saveUser(req.body, 1));
});


var saveUser = function (user, savetype) {
    if(user.id == 0) return addUser(user);
    mysql.getEntity('users', 'id=' + user.id).then(users => {
        // myLocalize.setLocale(users[0].language);
        var entityUser = savetype == 1 ? updateUser (users[0], user) : updateUserByAdmin (users[0], user);
        mysql.updateEntity('users', entityUser.id, entityUser).then(result => {
            return 'OK';
        }).catch(error => {
            return 'ERROR';
        });
    }).catch(error => {
        return 'ERROR';
    });
}

var addUser = function (user) {
    delete user.id;
    user.language = "RU";
    user.theme = "WHITE";
    user.verify = 0;
    user.token = createToken();
    mysql.insertEntity('users', user).then(result => {
        return 'OK';
    }).catch(error => {
        return 'ERROR';
    });
}

var updateUserByAdmin = function (lastUser, newData) {
    lastUser.fullName = newData.fullName;
    lastUser.role = newData.role;
    lastUser.dateOfBirth = newData.date;
    lastUser.email = newData.email;
    lastUser.password = newData.password;
    return lastUser;
}

var updateUser = function (lastUser, newData) {
    lastUser.language = newData.language;
    lastUser.theme = newData.theme;
    lastUser.fullName = newData.fullName;
    lastUser.dateOfBirth = newData.date;
    lastUser.password = newData.password;
    return lastUser;
}

app.post('/removeuser', urlencodedParser, function (req, res) {
    removeEntity(req, res, 'users');
});

app.post('/removecarpart', urlencodedParser, function (req, res) {
    removeEntity(req, res, 'carparts');
});

var removeEntity = function (req, res, table) {
    mysql.deleteEntity(table, 'id=' + req.body.id).then(result => {
        res.send('OK');
    }).catch(error => {
        res.send('ERROR');
    });
}

app.post('/saveuser', urlencodedParser, function (req, res) {
    res.send( saveUser(req.body, 0));
});

app.get('/addForm/:index', urlencodedParser, function (req, res) {
    mysql.getEntity('orders', 'id=' + req.params.index).then(orders => {
        mysql.getByQuery(SELECT_CARPARTS_OF_ORDER + req.params.index).then(carparts => {
            var price = 0;
            for (var i = 0; i < carparts.length; i++) {
                price += carparts[i].id;
            }
            res.render( "form", {index: req.params.index, order: orders[0], price: price});
        }).catch(error => {
            res.redirect('/');
        });
    }).catch(error => {
        res.redirect('/');
    });
});

app.get('/download/:index', urlencodedParser, function (req, res) {
    mysql.getEntity('carparts', 'id=' + req.params.index).then(carparts => {
        var name = __dirname + carparts[0].image;
        phantom.create().then(function(ph) {
            ph.createPage().then(function(page) {
                page.property('viewportQuantity', {width: 600, height: 400}).then(function() {
                    page.open('http://localhost:3000/carpart_html/' + carparts[0].id).then(function(status) {
                        page.render(name).then(function() {
                            res.sendFile(name);
                            ph.exit();
                        });
                    });
                });
            });
        });
    }).catch(error => {
        res.redirect('/');
    });
});

app.get('/carpart_html/:index', urlencodedParser, function (req, res) {
    mysql.getEntity('carparts', 'id=' + req.params.index).then(carparts => {
        res.redirect(carparts[0].image);
    }).catch(error => {
        res.redirect('/');
    });
});

app.post('/saveranking', urlencodedParser, function (req, res) {
    mysql.getEntity('rankings', 'userID=' + req.body.userID + " AND carpartID=" + req.body.carpartID).then(rankings => {
        if(rankings.length < 1) {
            mysql.insertEntity('rankings', req.body).then(result => {
                res.send('OK');
            }).catch(error => {
                res.send('ERROR');
            });
        } else {
            mysql.updateEntity('rankings', rankings[0].id  , req.body).then(result => {
                res.send('OK');
            }).catch(error => {
                res.send('ERROR');
            });
        }
    }).catch(error => {
        res.send('ERROR');
    });
});

app.post('/addcomment', urlencodedParser, function (req, res) {
    mysql.insertEntity('comments', req.body).then(result => {
        res.send('OK');
    }).catch(error => {
        res.send('ERROR');
    });
});


app.post('/addorder', urlencodedParser, function (req, res) {
    var order = req.body;
    order.userID = order.userID * 1;
    order.created_at = new Date().toISOString().replace('Z', '');
    mysql.insertEntity('orders', order).then(result => {
        mysql.getEntity('orders', '', 'id DESC').then(orders => {
            res.send(orders[0]);
        }).catch(error => {
            res.send('ERROR');
        });
    }).catch(error => {
        res.send('ERROR');
    });
});

app.post('/addinbacket', urlencodedParser, function (req, res) {
    console.log(req.session.order);
    var order = req.body;
    order.userID = order.userID * 1;
    order.created_at = new Date().toISOString().replace('Z', '')
    if(req.session.order == null) {
        mysql.insertEntity('orders', order).then(result => {
            mysql.getEntity('orders', '', 'id DESC').then(orders => {
                req.session.order = orders[0].id;
                res.send(orders[0]);
            }).catch(error => {
                console.log(error);
                res.send('ERROR');
            });
        }).catch(error => {
            console.log(error);
            res.send('ERROR');
        });
    } else {
        mysql.getEntity('orders', 'id=' + req.session.order).then(orders => {
            res.send(orders[0]);
        }).catch(error => {
            console.log(error)
            res.send('ERROR');
        });
    }
});


app.post('/addordercarpart', urlencodedParser, function (req, res) {
    var orderCarpart = req.body;
    mysql.insertEntity('ordercarparts', orderCarpart).then(result => {
        res.send('OK');
    }).catch(error => {
        res.send('ERROR');
    });
});

app.post('/addlike', urlencodedParser, function (req, res) {
    mysql.insertEntity('likes', req.body).then(result => {
        res.send('OK');
    }).catch(error => {
        res.send('ERROR');
    });
});

app.post('/removelike', urlencodedParser, function (req, res) {
    mysql.deleteEntity('likes', 'userID=' + req.body.userID + ' AND commentID=' + req.body.commentID).then(result => {
        res.send('OK');
    }).catch(error => {
        res.send('ERROR');
    });
});

app.post('/isneedupdate', urlencodedParser, function (req, res) {
    var id = req.body.id;

    mysql.getEntity('comments', 'carpartID=' + id).then(comments => {
        res.send({quantity: comments.length});
    }).catch(error => {
        res.send('ERROR');
    });
});

app.post('/savesetting', urlencodedParser, function (req, res) {
    var id = req.body.label;
    mysql.getEntity('orders', 'id=' + id).then(orders => {
        mysql.getEntity('ordercarparts', 'orderID=' + id).then(orderCarparts => {
            mysql.getByQuery(SELECT_ORDER_USER + id).then(orderUser => {
                req.session.order = null;
                doMail(orderUser.email + ", " + "admin.main@mail.ru", createMessage(orders[0], orderCarparts));
                res.send('OK');
            }).catch(error => {
                res.send('ERROR');
            });
        }).catch(error => {
            res.send('ERROR');
        });
    }).catch(error => {
        res.send('ERROR');
    });
});

app.post('/closeorder', urlencodedParser, function (req, res) {
    // console.log(req.session.order);
    req.session.order = null;
    res.send('OK');
});


app.post('/saveimg', urlencodedParser, upload.single('image'),  function (req, res) {
    var target_path =  '/public/uploads/' + createToken() + req.file.originalname;
    fs.writeFileSync(__dirname + target_path, req.file.buffer);
    res.send(target_path);
});

app.post('/addcarpart', urlencodedParser, function (req, res) {
    // console.log(req.file);
    // var target_path =  '/public/uploads/' + createToken() + req.image.originalname;
    // fs.writeFileSync(__dirname + target_path, req.file.buffer);

    var carpart = req.body;
    // console.log(carpart);
    // carpart.image = target_path;
    var tag = carpart.tags;
    delete carpart.tags;
    if(carpart.id == 0 ) {
        delete carpart.id;
        mysql.insertEntity('carparts', carpart).then(result => {
            mysql.getEntity('carparts', '',  'id DESC').then(carparts => {
                    addTags(tag, carparts[0].id);
                    res.send(carparts[0].id.toString());
                }).catch(error => {
                    res.send('ERROR');
                });
        }).catch(error => {   
            res.send('ERROR');
        });
    } else {
        var id = carpart.id;
        // console.log(carpart);
        mysql.updateEntity('carparts', carpart.id, carpart).then(result => {
            // console.log(result);
            res.send(id);
        }).catch(error => {
            console.log(error);
            res.send('ERROR');
        });
    }
});

var addTags = function (tags, carpartID){
    var tagsArray = new String(tags).split(','), tag = {
        carpartID: carpartID,
        tagName: "",  
    };
    mysql.deleteEntity('carparttags', "1").then(result => {}).catch(error => { });
    for (var i = 0; i < tagsArray.length; i++) {
        tag.tagName = tagsArray[i];
        mysql.insertEntity('carparttags', tag).then(result => {}).catch(error => {});
    }

}

var createMessage = function (order, orderCarparts) {
    var head ="Новый заказ ОФОРМЛЕН!", body;
    body = "<h1>Поступил новый заказ</h1>";
    body += '<p><b>Адрес доставки: </b>' + order.address + '</p>';
    body += '<p><b>Контактный телефон: </b>' + order.phone + '</p>';
    body += '<p><b>ИД Адресьзователя: </b>' + order.userID + '</p>';
    for (var i = 0; i < orderCarparts.length; i++) {
        body += '<div><h2>Товар#' + (i+1) + '</h2>';
            body += '<p><b>ИД Товара: </b>' + orderCarparts[i].carpartID + '</p>';
            body += '<p><b>Адрес: </b>' + orderCarparts[i].address + '</p>';
            body += '<p><b>Количество: </b>' + orderCarparts[i].quantity + '</p>';
            body += '<p><b>Цвет (HEX): </b>' + orderCarparts[i].color + '</p>';
        body += '</div>';
    }
    return {head: head, body: body};
}

//Страница 404

app.use(function(req, res, next){
    res.status(404);
    if (req.accepts('html')) {
        res.render('error', {error: 'Ошибка 404: Страница "' + req.url + '" не найдена', title: E404_ERROR_HEAD, myLocalize: myLocalize});
    } else if (req.accepts('json')) {
        res.send({ error: 'Not found' });
    }
});



app.listen(3000, function () {
    console.log('Server running on port №3000...');
});


