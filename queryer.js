var mysql = require('mysql');
const COMMENT_FIELDS = ['userID', 'carpartID', 'text'];
const LIKE_FIELDS = ['userID', 'commentID'];
const MEDAL_FIELDS = ['shortText', 'imageAddress'];
const RANKING_FIELDS = ['value', 'userID', 'carpartID'];
const CARPART_FIELDS = ['name', 'shortText', 'color', 'price', 'ranking', 'userID', 'image'];
const CARPARTTAGS_FIELDS = ['carpartID', 'tagName'];
const USERMEDAL_FIELDS = ['userID', 'medalID'];
const USER_FIELDS = ['email', 'password', 'role', 'fullName', 'dateOfBirth', 'language', 'theme', 'verify', 'token'];
const ORDER_FIELDS = ['userID', 'address', 'phone', 'created_at'];
const ORDERCARPART_FIELDS = ['carpartID', 'orderID', 'address', 'quantity', 'color'];

var pool  = mysql.createPool({
	host     : 'localhost',
	user     : 'root',
	password : 'password',
	database : 'cars_parts_automatizator'
});

var getConnection = function(callback) {
	pool.getConnection(function(err, connection) {
		callback(err, connection);
	});
};

var createPromise = function (query) {
	return new Promise((resolve, reject) => {
		getConnection((err, connection) => {
            console.log(err);
			connection.query(query, function(err, rows) {
				if (err) reject(err);
				resolve(rows);
			});
			connection.release();
		});
	});
}


var getByQuery = function (query) {
    return createPromise(query);
}

var getEntity = function (table, where, orderBy, limit) {
    return createPromise(createSelectQuery(table, where, orderBy, limit));
}

var createSelectQuery = function (table, where, orderBy, limit) {
	where = (where != null && where != '') ? 'WHERE ' + where + ' ' : '';
	orderBy = (orderBy != null && orderBy != '') ? 'ORDER BY ' + orderBy + ' ' : '';
	limit = (limit != null && limit != '') ? 'LIMIT ' + limit : '';
	return 'SELECT * FROM ' + table + ' ' + where + orderBy + limit;
}

var deleteEntity = function (table, where) {
    return createPromise(createDeleteQuery(table, where));
}

var createDeleteQuery = function (table, where) {
    where = (where != null && where != '') ? 'WHERE ' + where + ' ' : '';
    return 'DELETE FROM ' + table + ' ' + where;
}

var insertEntity = function (table, entity) {
    return createPromise(createInsertQuery(table, entity));
}

var createInsertQuery = function (table, entity) {
    return 'INSERT INTO ' + table + '(' + getEntityFields(table) + ') VALUES(' + getEntityValues(entity) + ')';
}

var updateEntity = function (table, id, entity) {
    delete entity.id;
    return createPromise(createUpdateQuery(table, id, entity));
}

var createUpdateQuery = function (table, id, entity) {
    return 'UPDATE ' + table + ' SET ' + getSettedValues(entity, checkFieldType(table)) + ' WHERE id=' + id;
}


var getSettedValues = function (entity, fields) {
    return prepareQuery(entity, fields);
}

var getEntityValues = function (entity) {
    return prepareQuery(entity, null);
}

var prepareQuery = function (entity, fields) {
    var result = '';
    entity = Object.values(entity);
    for (var i = 0; i < entity.length; i++) {
        var apos = (typeof entity[i]) !== 'number' ? '"' : '';
        if(fields != null) 
            result += ' ' + fields[i] + '=' + apos + entity[i] + apos;
        else
            result += apos + entity[i] + apos;
        if (i != entity.length-1) result +=',';
    }
    return result;
}

var getEntityFields = function (table) {
    return (checkFieldType(table)).toString();
}

var checkFieldType = function (table) {
    switch(table) {
        case 'comments': return COMMENT_FIELDS;
        case 'likes': return LIKE_FIELDS;
        case 'medals': return MEDAL_FIELDS;
        case 'rankings': return RANKING_FIELDS;
        case 'carparts': return CARPART_FIELDS;
        case 'carparttags': return CARPARTTAGS_FIELDS;
        case 'usermedals': return USERMEDAL_FIELDS;
        case 'users': return USER_FIELDS;
        case 'orders': return ORDER_FIELDS;
        case 'ordercarparts': return ORDERCARPART_FIELDS;
    }
}



// getEntity('carparts', 'id >= 1', 'id').then(result => {
//   console.log(result);
// }).catch(error => {
// 	console.error(error);
// });

// deleteEntity('users', 'id = 1').then(result => {
//   	console.log(result);
// }).catch(error => {
// 	console.error(error);
// });

// insertEntity('orders',  { 'userID': 1, 'address': 'j', 'phone': '8' }).then(result => {
//     console.log(result);
// }).catch(error => {
//     console.error(error);
// });

// updateEntity('comments',  6, {'userID': 2, 'carpartID': 3, 'text': 'Деталь как деталь! Ок она!'}).then(result => {
//     console.log(result);
// }).catch(error => {
//     console.error(error);
// });


module.exports = {
    getByQuery: getByQuery,
    insertEntity: insertEntity,
    getEntity: getEntity,
    updateEntity: updateEntity,
    deleteEntity: deleteEntity,
}