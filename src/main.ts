/*
learn-to-earn challenge #1

spy message 

use merkle tree to store the 100 eligible addresses.  
the addresses and messages are stored off-chain.  
only the merkle root is stored on-chain.  
merkle root in smart contract state is used to verify that depositor addresses 
is in the eligible list.  


This is based on a o1js merkle tree example.  https://github.com/o1-labs/o1js/blob/main/src/examples/zkapps/merkle_tree/merkle_zkapp.ts 

*/

import {
  SmartContract,
  Poseidon,
  Field,
  State,
  state,
  PublicKey,
  Mina,
  method,
  UInt32,
  PrivateKey,
  AccountUpdate,
  MerkleTree,
  MerkleWitness,
  Struct,
  Bool,
  Provable,
} from 'o1js';

import { treeHeight, SpyMsg, Account, MyMerkleWitness } from './SpyMsg.js';

const doProofs = true;

// we need the initiate tree root in order to tell the contract about our off-chain storage
let initialTreeroot: Field = Field(0);

type Names = 'bob' | 'alice' | 'carol' | 'dave';

let Local = Mina.LocalBlockchain({ proofsEnabled: doProofs });
Mina.setActiveInstance(Local);
let initialBalance = 10_000_000_000;

let feePayerKey = Local.testAccounts[0].privateKey;
let feePayer = Local.testAccounts[0].publicKey;

// the zkapp account
let zkappKey = PrivateKey.random();
let zkappAddress = zkappKey.toPublicKey();

// this map serves as our off-chain in-memory storage
let Accounts: Map<string, Account> = new Map<Names, Account>(
  ['bob', 'alice', 'carol', 'dave'].map((name: string, index: number) => {
    return [
      name as Names,
      new Account({
        publicKey: Local.testAccounts[index].publicKey,
        msg: Field(0),
      }),
    ];
  })
);

// create our eligible list as a merkle tree.  

// we now need "wrap" the Merkle tree around our off-chain storage
// we initialize a new Merkle tree with height 8 
const tree = new MerkleTree(treeHeight);

// set up the eligible list 
tree.setLeaf(0n, Accounts.get('bob')!.hash());
tree.setLeaf(1n, Accounts.get('alice')!.hash());
tree.setLeaf(2n, Accounts.get('carol')!.hash());
tree.setLeaf(3n, Accounts.get('dave')!.hash());


// now that we got our accounts set up, we need the merkle treeroot to deploy our contract!
initialTreeroot = tree.getRoot();

let spyMsgZkApp = new SpyMsg(zkappAddress);
console.log('Deploying SpyMsg..');
if (doProofs) {
  await SpyMsg.compile();
}
let tx = await Mina.transaction(feePayer, () => {
  AccountUpdate.fundNewAccount(feePayer).send({
    to: zkappAddress,
    amount: initialBalance,
  });
  spyMsgZkApp.deploy();
  spyMsgZkApp.initState(initialTreeroot);
});
await tx.prove();
await tx.sign([feePayerKey, zkappKey]).send();

console.log('Initial msg: ' + Accounts.get('bob')?.msg);

console.log('inputting msg..');
await inputMsg('bob', 0n, 0b001110);

console.log('Final msg: ' + Accounts.get('bob')?.msg);

// test checking msg flags
//--------------------------------------
console.log("-----------------------------------------");
console.log("testing checkMsg()...");
spyMsgZkApp.checkMsg(Field(0b000001)).assertTrue();
spyMsgZkApp.checkMsg(Field(0b000011)).assertFalse();
spyMsgZkApp.checkMsg(Field(0b000110)).assertTrue();
spyMsgZkApp.checkMsg(Field(0b000010)).assertFalse();
spyMsgZkApp.checkMsg(Field(0b001100)).assertTrue();
spyMsgZkApp.checkMsg(Field(0b011100)).assertFalse();
spyMsgZkApp.checkMsg(Field(0b101100)).assertFalse();



async function inputMsg(name: Names, index: bigint, msg: number) {
  let account = Accounts.get(name)!;
  let w = tree.getWitness(index);
  let witness = new MyMerkleWitness(w);

  let tx = await Mina.transaction(feePayer, () => {
      spyMsgZkApp.inputMsg(Field(msg), account, witness);
  });
  await tx.prove();
  await tx.sign([feePayerKey, zkappKey]).send();

  // if the transaction was successful, we can update our off-chain storage as well
  account.msg = Field(msg);
  tree.setLeaf(index, account.hash());
  spyMsgZkApp.treeroot.get().assertEquals(tree.getRoot());
}


