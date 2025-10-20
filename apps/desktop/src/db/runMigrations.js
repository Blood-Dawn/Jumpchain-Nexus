/*
Bloodawn

Copyright (c) 2025 Age-Of-Ages

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import envPaths from "env-paths";
import initSqlJs from "sql.js";
var PRODUCT_NAME = "Jumpchain Nexus";
var DB_FILENAME = "app.db";
function resolveMigrationDir() {
    var __filename = fileURLToPath(import.meta.url);
    var __dirname = path.dirname(__filename);
    return path.join(__dirname, "migrations");
}
function loadMigrations(dir) {
    return __awaiter(this, void 0, void 0, function () {
        var entries;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, readdir(dir)];
                case 1:
                    entries = (_a.sent());
                    return [2 /*return*/, entries
                            .filter(function (entry) { return entry.endsWith(".sql"); })
                            .sort()
                            .map(function (entry) { return path.join(dir, entry); })];
            }
        });
    });
}
function readSqlFile(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var buffer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, readFile(filePath)];
                case 1:
                    buffer = _a.sent();
                    return [2 /*return*/, buffer.toString("utf8")];
            }
        });
    });
}
function splitStatements(sql) {
    return sql
        .split(/;\s*(?:\n|$)/)
        .map(function (statement) { return statement.trim(); })
        .filter(Boolean)
        .map(function (statement) { return "".concat(statement, ";"); });
}
function ensureConfigDir() {
    return __awaiter(this, void 0, void 0, function () {
        var paths, target;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    paths = envPaths(PRODUCT_NAME, { suffix: "" });
                    target = path.join(paths.config);
                    if (!!existsSync(target)) return [3 /*break*/, 2];
                    return [4 /*yield*/, mkdir(target, { recursive: true })];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/, target];
            }
        });
    });
}
function loadDatabaseBinary(dbPath) {
    return __awaiter(this, void 0, void 0, function () {
        var buffer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!existsSync(dbPath)) {
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, readFile(dbPath)];
                case 1:
                    buffer = _a.sent();
                    return [2 /*return*/, new Uint8Array(buffer)];
            }
        });
    });
}
function saveDatabase(dbPath, database) {
    return __awaiter(this, void 0, void 0, function () {
        var binaryArray;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    binaryArray = database.export();
                    return [4 /*yield*/, writeFile(dbPath, Buffer.from(binaryArray))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function applyMigrations() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, SQL, configDir, dbPath, migrationsDir, migrations, binary, db, _i, migrations_1, migration, rawSql, statements, _b, statements_1, statement;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, Promise.all([initSqlJs(), ensureConfigDir()])];
                case 1:
                    _a = _c.sent(), SQL = _a[0], configDir = _a[1];
                    dbPath = path.join(configDir, DB_FILENAME);
                    migrationsDir = resolveMigrationDir();
                    return [4 /*yield*/, loadMigrations(migrationsDir)];
                case 2:
                    migrations = _c.sent();
                    return [4 /*yield*/, loadDatabaseBinary(dbPath)];
                case 3:
                    binary = _c.sent();
                    db = binary ? new SQL.Database(binary) : new SQL.Database();
                    _i = 0, migrations_1 = migrations;
                    _c.label = 4;
                case 4:
                    if (!(_i < migrations_1.length)) return [3 /*break*/, 7];
                    migration = migrations_1[_i];
                    return [4 /*yield*/, readSqlFile(migration)];
                case 5:
                    rawSql = _c.sent();
                    statements = splitStatements(rawSql);
                    for (_b = 0, statements_1 = statements; _b < statements_1.length; _b++) {
                        statement = statements_1[_b];
                        db.exec(statement);
                    }
                    _c.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 4];
                case 7: return [4 /*yield*/, saveDatabase(dbPath, db)];
                case 8:
                    _c.sent();
                    console.log("\u2705 Database ready at ".concat(dbPath));
                    return [2 /*return*/];
            }
        });
    });
}
applyMigrations().catch(function (error) {
    console.error("Failed to run migrations", error);
    process.exitCode = 1;
});
