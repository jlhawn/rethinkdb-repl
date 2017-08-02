const fs = require('fs');
const r = require('rethinkdb');
const util = require('util');
const repl = require('repl');

const RDBVal = r.db().constructor.__super__.constructor.__super__.constructor;

/*
 * loadTLSConfig reads files for the server CA, client key, and client
 * certificate.
 */
function loadTLSConfig(caFilename, keyFilename, certFilename) {
    return {
        ca: fs.readFileSync(caFilename),
        key: fs.readFileSync(keyFilename),
        cert: fs.readFileSync(certFilename)
    }
}

class Session {
    constructor(host, port, defaultEval) {
        var tlsConfig = loadTLSConfig("/tls/ca.pem", "/tls/key.pem", "/tls/cert.pem");
        this.connected = r.connect({
            host: host,
            port: port,
            ssl: tlsConfig
        });
    }
}

function wrapREPLCallback(session, callback) {
    return function(err, val) {
        if (err || !val || !(val instanceof RDBVal)) {
            // There's either an error or some result which is not a
            // RethinkDB value. Just trigger the callback immediately.
            callback(err, val);
            return;
        }

        var query = val;

        // Create a promise to run the query. This chain will eventually
        // trigger the callback.
        session.connected.then(function(conn) {
            return query.run(conn).then(function(cursor) {
                if (cursor.toArray) {
                    return cursor.toArray();
                }

                return cursor;
            });
        }).then(function(results) {
            callback(null, results);
        }).catch(function(queryErr) {
            callback(queryErr);
        });
    };
}

function writer(object) {
    return util.inspect(object, {depth: null, colors: true});
}

var session = new Session(process.argv[2], +process.argv[3]);

var queryRepl = repl.start({prompt: '> ', useGlobal: false, writer: writer});
queryRepl.context.r = r;

var defaultEval = queryRepl.eval;

queryRepl.eval = function(code, context, file, callback) {
    // The callback will be given (err, result). We can hijack it to modify the
    // result.
    defaultEval(code, context, file, wrapREPLCallback(session, callback));
};

queryRepl.on('exit', function() {
  process.exit();
});
