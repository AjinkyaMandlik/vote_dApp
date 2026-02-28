#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Env, Symbol, Vec, Map};

#[contracttype]
pub struct Poll {
    pub question: Symbol,
    pub options: Vec<Symbol>,
    pub votes: Map<Symbol, u32>,
}

#[contract]
pub struct PollContract;

#[contractimpl]
impl PollContract {

    pub fn create_poll(env: Env, question: Symbol, options: Vec<Symbol>) {
        let mut votes = Map::new(&env);

        for option in options.iter() {
            votes.set(option.clone(), 0);
        }

        let poll = Poll {
            question,
            options,
            votes,
        };

        env.storage().instance().set(&Symbol::new(&env, "POLL"), &poll);
    }

    pub fn vote(env: Env, option: Symbol) {
        let mut poll: Poll = env.storage().instance()
            .get(&Symbol::new(&env, "POLL"))
            .unwrap();

        let count = poll.votes.get(option.clone()).unwrap_or(0);
        poll.votes.set(option, count + 1);

        env.storage().instance().set(&Symbol::new(&env, "POLL"), &poll);
    }

    pub fn get_results(env: Env) -> Map<Symbol, u32> {
        let poll: Poll = env.storage().instance()
            .get(&Symbol::new(&env, "POLL"))
            .unwrap();

        poll.votes
    }
}