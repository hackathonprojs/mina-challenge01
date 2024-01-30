// tree height = 8.  enough to store the 100 address

import {
    Bool,
    Field,
    MerkleWitness,
    method,
    Poseidon,
    Provable,
    PublicKey,
    SmartContract,
    State,
    state,
    Struct,
} from 'o1js';

// tree height = 8.  enough to store the 100 address
// our eligible list merkle tree has max 100 addresses. 
export const treeHeight = 8;

export class MyMerkleWitness extends MerkleWitness(treeHeight) {}

export class Account extends Struct({
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

/*
  spy message 

  use merkle tree to store the 100 eligible addresses.  
  the addresses and messages are stored off-chain.  
  only the merkle root is stored on-chain.  
  merkle root in smart contract state is used to verify that depositor addresses 
  is in the eligible list.  
*/

export class SpyMsg extends SmartContract {
    events = {
      "input-msg": Field,
    }
  
  
    // this is merkle root of our eligible list.
    @state(Field) commitment = State<Field>();
  
    @method init() {
      super.init();
      
    }

    @method initState(initialTreeRoot:Field) {
        this.commitment.set(initialTreeRoot);
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
  
      this.emitEvent('input-msg', msg);
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