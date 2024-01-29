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

const doProofs = true;

// tree height = 8.  enough to store the 100 address
// our eligible list merkle tree has max 100 addresses. 
const treeHeight = 8;

class MyMerkleWitness extends MerkleWitness(treeHeight) {}

class Account extends Struct({
  publicKey: PublicKey,
  msg: Field,
}) {
  hash(): Field {
    return Poseidon.hash(Account.toFields(this));
  }

  addMsg(msg: Field) {
    return new Account({
      publicKey: this.publicKey,
      msg: msg,
    });
  }

}
// we need the initiate tree root in order to tell the contract about our off-chain storage
let initialCommitment: Field = Field(0);

/*
  spy message 

  use merkle tree to store the 100 eligible addresses.  
  the addresses and messages are stored off-chain.  
  only the merkle root is stored on-chain.  
  merkle root in smart contract state is used to verify that depositor addresses 
  is in the eligible list.  
*/

class SpyMsg extends SmartContract {
  // a commitment is a cryptographic primitive that allows us to commit to data, with the ability to "reveal" it later
  // this is merkle root of our eligible list.
  @state(Field) commitment = State<Field>();

  @method init() {
    super.init();
    this.commitment.set(initialCommitment);
  }

  @method
  inputMsg(msg: Field, account: Account, path: MyMerkleWitness) {  
    this.checkMsg(msg).assertTrue();

    // we fetch the on-chain commitment
    let commitment = this.commitment.get();
    this.commitment.requireEquals(commitment);

    // we check that the account is within the committed Merkle Tree
    path.calculateRoot(account.hash()).assertEquals(commitment);

    // we update the account with new msg
    let newAccount = account.addMsg(msg);

    // we calculate the new Merkle Root, based on the account changes
    let newCommitment = path.calculateRoot(newAccount.hash());

    this.commitment.set(newCommitment);
  }

  /**
   * check the flags to see if flags are valid.  
   * the flags are the last 6 bits of the msg. 
   * 
   * The flags should be checked according to the following rules :
   * If flag 1 is true, then all other flags must be false
   * If flag 2 is true, then flag 3 must also be true.
   * If flag 4 is true, then flags 5 and 6 must be false.
   * @param msg 
   */
  @method
  checkMsg(msg: Field):Bool {
    let bitmap = msg.toBits();

    // the bitmap is indexed from right to left.  [0] is at the right. 
    let flag1:Bool = bitmap[0];
    let flag2:Bool = bitmap[1];
    let flag3:Bool = bitmap[2];
    let flag4:Bool = bitmap[3];
    let flag5:Bool = bitmap[4];
    let flag6:Bool = bitmap[5];

    let rule1Satisfied:Bool = Provable.if(flag1, 
        flag2.not()
        .and(flag3.not())
        .and(flag4.not())
        .and(flag5.not())
        .and(flag6.not()),
        Bool(true));

    let rule2Satisfied:Bool = Provable.if(flag2, flag3, Bool(true));

    let rule3Satisfied:Bool = Provable.if(flag4, flag5.not().and(flag6.not()), Bool(true));

    // console.log(`rule1 satisfied: %s`, rule1Satisfied.toBoolean());
    // console.log(`rule2 satisfied: %s`, rule2Satisfied.toBoolean());
    // console.log(`rule3 satisfied: %s`, rule3Satisfied.toBoolean());

    // rule1Satisfied.assertTrue();
    // rule2Satisfied.assertTrue();
    // rule3Satisfied.assertTrue();

    return rule1Satisfied.and(rule2Satisfied).and(rule3Satisfied);
    
  }
}

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
// we initialize a new Merkle Tree with height 8 
const Tree = new MerkleTree(treeHeight);

// right now 
Tree.setLeaf(0n, Accounts.get('bob')!.hash());
Tree.setLeaf(1n, Accounts.get('alice')!.hash());
Tree.setLeaf(2n, Accounts.get('carol')!.hash());
Tree.setLeaf(3n, Accounts.get('dave')!.hash());


// now that we got our accounts set up, we need the commitment to deploy our contract!
initialCommitment = Tree.getRoot();

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
});
await tx.prove();
await tx.sign([feePayerKey, zkappKey]).send();

console.log('Initial msg: ' + Accounts.get('bob')?.msg);

console.log('inputting msg..');
await inputMsg('bob', 0n, 24);

console.log('Final msg: ' + Accounts.get('bob')?.msg);

async function inputMsg(name: Names, index: bigint, msg: number) {
  let account = Accounts.get(name)!;
  let w = Tree.getWitness(index);
  let witness = new MyMerkleWitness(w);

  let tx = await Mina.transaction(feePayer, () => {
      spyMsgZkApp.inputMsg(Field(msg), account, witness);
  });
  await tx.prove();
  await tx.sign([feePayerKey, zkappKey]).send();

  // if the transaction was successful, we can update our off-chain storage as well
  account.msg = Field(msg);
  Tree.setLeaf(index, account.hash());
  spyMsgZkApp.commitment.get().assertEquals(Tree.getRoot());
}
