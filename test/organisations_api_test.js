process.env.NODE_ENV = 'test';

const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../server');
const should = require('chai').should();
// const config = require('../knexfile.js')['test'];
//
// module.exports = require('knex')(config);

chai.use(chaiHttp);

describe('Organisations', () => {
  // beforeEach((done) => {
  //   knex('relationships').del().then(() => {
  //     knex('organisations').del().then(() => {
  //       done();
  //     });
  //   });
  // });
  describe('/POST organisations', () => {
    it('it should return the correct relationships for an org', (done) => {
      const inputJson = {
        'org_name': 'Parent1',
        'daughters': [
          {
            'org_name': 'Child1',
            'daughters': [
              {
                'org_name': 'GrandChild1',
              },
            ],
          },
          {
            'org_name': 'Child2',
            'daughters': [
              {
                'org_name': 'GrandChild3',
              },
              {
                'org_name': 'GrandChild4',
                'daughters': [
                  {
                    'org_name': 'GreatGrandChild1',
                  },
                ],
              },
            ],
          },
        ],
      };
      const expectedJson = [
        {
          'org_name': 'Child2',
          'relationship_type': 'parent',
        },
        {
          'org_name': 'GrandChild3',
          'relationship_type': 'sister',
        },
        {
          'org_name': 'GreatGrandChild1',
          'relationship_type': 'daughter',
        },
      ];

      // POST organisations
      chai.request(server)
          .post('/organisations')
          .send(inputJson)
          .end((err, res) => {
            res.should.have.status(201);

            // GET organisations
            chai.request(server)
                .get('/organisations')
                .query({name: 'GrandChild4'})
                .end((err, res) => {
                  res.should.have.status(200);
                  res.body.should.deep.equal(expectedJson);
                  done();
                });
          });

    });
  });
});
