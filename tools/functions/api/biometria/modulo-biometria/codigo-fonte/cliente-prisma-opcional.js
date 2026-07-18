'use strict';

let clientePrisma;

function obterClientePrismaOpcional() {
  if (clientePrisma) return clientePrisma;

  try {
    const { PrismaClient } = require('@prisma/client');
    clientePrisma = new PrismaClient();
    return clientePrisma;
  } catch (_erro) {
    return null;
  }
}

module.exports = { obterClientePrismaOpcional };
